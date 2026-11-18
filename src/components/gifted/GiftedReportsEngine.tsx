import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  BarChart3,
  BookOpen,
  Calendar,
  CheckCircle2,
  Download,
  ExternalLink,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Layers,
  Loader2,
  QrCode,
  Sparkles,
  UserCheck,
  Users,
} from 'lucide-react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import {
  APPROVED_SCHOOL_SEMESTERS,
  ApprovedSchoolSemester,
  SchoolSettings,
} from '../../types';
import {
  buildGiftedStatisticalReportModel,
  computeGiftedCompletionMetrics,
  getActiveGenerationAttachmentsForRecord,
  getDefaultGiftedAttachmentRepository,
  getGiftedGenderedTerms,
  GIFTED_CLASSIFICATION_LABELS,
  GIFTED_COORDINATOR_WORK_KIND_LABELS,
  GIFTED_EXECUTION_STATUS_LABELS,
  GIFTED_PARTICIPATION_CATEGORY_LABELS,
  GIFTED_SECTION3_FIXED_LOG_LABELS,
  GiftedAttachmentRecord,
  GiftedCoordinatorAdditionalWorkItem,
  GiftedCoordinatorRecord,
  GiftedSection2EvidenceItem,
  GiftedSection2LinkItem,
  GiftedSection2ParticipantItem,
  GiftedSection3Data,
  GiftedStudentRecord,
  GiftedUnifiedSection2Record,
  resolveGiftedBasicInfo,
  resolveStudentParticipationsWithStudentInfo,
} from '../../utils/giftedRecordEngine';
import {
  buildMultiPageJpegPdfBytes,
  downloadGiftedPdfBytes,
  GiftedPdfLinkAnnotation,
  GiftedPdfRenderedPage,
} from '../../utils/giftedReportPdfGenerator';
import {
  drawQrCodeOnCanvas,
  generateQrSvgDataUrl,
} from '../../utils/qrCodeGenerator';
import { normalizeApprovedSemester } from '../../utils/settingsStorage';
import { sanitizeFilenameSegment } from '../../utils/zipBuilder';

// إعداد عامل pdfjs-dist في المتصفح لمعالجة ملفات PDF متعددة الصفحات بصرياً
if (typeof window !== 'undefined' && GlobalWorkerOptions) {
  try {
    GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  } catch {
    // في حال تعذر تحميل المسار كـ URL قياسي
  }
}

export interface GiftedReportsEngineProps {
  record: GiftedCoordinatorRecord;
  settings: SchoolSettings;
  updateRecord: (
    updater: (prev: GiftedCoordinatorRecord) => GiftedCoordinatorRecord
  ) => void;
}

/** الأنواع الخمسة المعتمدة حصرياً لمركز التقارير */
export type ApprovedReportKind =
  | 'program_or_initiative_report'
  | 'student_report'
  | 'periodic_coordinator_report'
  | 'final_record_report'
  | 'statistical_students_report';

interface ApprovedReportTabMeta {
  id: ApprovedReportKind;
  orderNumber: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
}

const APPROVED_REPORT_TABS: ApprovedReportTabMeta[] = [
  {
    id: 'program_or_initiative_report',
    orderNumber: '01',
    title: 'تقرير برنامج أو مبادرة',
    subtitle: 'بيانات البرنامج أو المبادرة أو التقرير ومشاركاته ونتائجه وشواهده وروابطه',
    icon: <Layers className="w-4 h-4 shrink-0" aria-hidden="true" />,
  },
  {
    id: 'student_report',
    orderNumber: '02',
    title: 'تقرير طالب',
    subtitle: 'بيانات الطالب ومشاركاته وإنجازاته وسجله التاريخي من السجل المركزي',
    icon: <UserCheck className="w-4 h-4 shrink-0" aria-hidden="true" />,
  },
  {
    id: 'periodic_coordinator_report',
    orderNumber: '03',
    title: 'تقرير دوري لأعمال المنسق',
    subtitle: 'أعمال المنسق وسجلاته المرتبطة بالفترة المختارة (العام الدراسي والفصل الدراسي)',
    icon: <Calendar className="w-4 h-4 shrink-0" aria-hidden="true" />,
  },
  {
    id: 'final_record_report',
    orderNumber: '04',
    title: 'التقرير الختامي للسجل',
    subtitle: 'الغلاف الرسمي والفهرس وبيانات الطلاب والبرامج والنماذج والأدلة والإحصاءات',
    icon: <FileCheck2 className="w-4 h-4 shrink-0" aria-hidden="true" />,
  },
  {
    id: 'statistical_students_report',
    orderNumber: '05',
    title: 'التقرير الإحصائي للطلاب',
    subtitle: 'إحصاءات الطلاب والمؤشرات المعتمدة مع فصل البرامج الوزارية عن المسابقات والمبادرات',
    icon: <BarChart3 className="w-4 h-4 shrink-0" aria-hidden="true" />,
  },
];

/** الأقسام السبعة المعتمدة في التقرير الختامي للسجل */
export const FINAL_REPORT_SEVEN_APPROVED_SECTIONS = [
  { number: '١', id: 'cover', title: 'غلاف رسمي' },
  { number: '٢', id: 'toc', title: 'فهرس' },
  { number: '٣', id: 'students', title: 'بيانات الطلاب' },
  { number: '٤', id: 'programs', title: 'البرامج والتقارير والمبادرات' },
  { number: '٥', id: 'models_logs', title: 'النماذج والسجلات' },
  { number: '٦', id: 'evidences', title: 'الأدلة والمرفقات' },
  { number: '٧', id: 'statistics', title: 'الإحصاءات ذات الصلة' },
] as const;

export interface RenderedPdfPagePreview {
  blobKey: string;
  evidenceId: string;
  evidenceTitle: string;
  evidenceCaption?: string;
  sourceRecordTitle: string;
  filename: string;
  pageNumber: number;
  totalPages: number;
  dataUrl: string;
  width: number;
  height: number;
}

export interface ResolvedVisualEvidenceItem {
  evidenceId: string;
  blobKey: string;
  title: string;
  caption?: string;
  filename: string;
  mimeType: string;
  sourceRecordId: string;
  sourceRecordTitle: string;
  kind: 'image' | 'pdf';
  imageDataUrl?: string;
  pdfPages?: RenderedPdfPagePreview[];
}

const DEFAULT_SECTION3_DATA: GiftedSection3Data = {
  giftedStudentsLog: [],
  programParticipantsLog: [],
  studentAchievementsLog: [],
  meetingsLog: [],
  visitsAndPartnershipsLog: [],
  readyTemplates: [],
};

function hasNonEmptyText(val: string | undefined | null): val is string {
  return typeof val === 'string' && val.trim().length > 0;
}

function normalizeAcademicYearComparison(year: string | undefined | null): string {
  if (!year) return '';
  return year.trim().replace(/\s+/g, '');
}

function matchesSelectedPeriod(
  itemAcademicYear: string | undefined,
  itemSemester: string | undefined,
  selectedAcademicYear: string,
  selectedSemester: ApprovedSchoolSemester,
  defaultAcademicYear: string,
  defaultSemester: ApprovedSchoolSemester
): boolean {
  const effectiveYear = hasNonEmptyText(itemAcademicYear)
    ? itemAcademicYear.trim()
    : defaultAcademicYear;
  const effectiveSemester = hasNonEmptyText(itemSemester)
    ? normalizeApprovedSemester(itemSemester)
    : defaultSemester;

  return (
    normalizeAcademicYearComparison(effectiveYear) ===
      normalizeAcademicYearComparison(selectedAcademicYear) &&
    effectiveSemester === selectedSemester
  );
}

/**
 * تحويل بايتات ملف PDF إلى صور صفحات مرئية باستخدام pdfjs-dist
 * مع الحفاظ التام على المرفق الأصلي دون تعديله أو حذفه
 */
async function renderPdfAttachmentPagesViaPdfJs(params: {
  bytes: Uint8Array;
  blobKey: string;
  evidenceId: string;
  evidenceTitle: string;
  evidenceCaption?: string;
  sourceRecordTitle: string;
  filename: string;
}): Promise<RenderedPdfPagePreview[]> {
  if (typeof document === 'undefined') return [];
  try {
    // نسخ البايتات لمنع نقل ملكية الـ ArrayBuffer الأصلي إلى الـ Worker
    const safeBytesCopy = new Uint8Array(params.bytes.slice(0));
    const loadingTask = getDocument({
      data: safeBytesCopy,
      useSystemFonts: true,
    });
    const pdfDoc = await loadingTask.promise;
    const totalPages = pdfDoc.numPages;
    const pages: RenderedPdfPagePreview[] = [];

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.ceil(viewport.width));
      canvas.height = Math.max(1, Math.ceil(viewport.height));
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({
          canvas,
          canvasContext: ctx,
          viewport,
        }).promise;
        const dataUrl = canvas.toDataURL('image/png');
        pages.push({
          blobKey: params.blobKey,
          evidenceId: params.evidenceId,
          evidenceTitle: params.evidenceTitle,
          evidenceCaption: params.evidenceCaption,
          sourceRecordTitle: params.sourceRecordTitle,
          filename: params.filename,
          pageNumber: pageNum,
          totalPages,
          dataUrl,
          width: canvas.width,
          height: canvas.height,
        });
      }
    }

    try {
      await pdfDoc.cleanup();
    } catch {
      // ignore cleanup errors
    }

    return pages;
  } catch {
    return [];
  }
}

function uint8ArrayToDataUrl(bytes: Uint8Array, mimeType: string): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const sub = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...sub);
  }
  const base64 = typeof btoa === 'function' ? btoa(binary) : '';
  return `data:${mimeType || 'image/jpeg'};base64,${base64}`;
}

function loadImageElementFromDataUrl(dataUrl: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined' || !dataUrl) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

async function loadOfficialMinistryLogoForReports(): Promise<HTMLImageElement | null> {
  if (typeof Image === 'undefined') return null;
  const rawBase =
    typeof import.meta !== 'undefined' &&
    import.meta.env &&
    typeof import.meta.env.BASE_URL === 'string'
      ? import.meta.env.BASE_URL
      : './';
  const normalizedBase = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;
  return await new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = `${normalizedBase}moe-logo.png`;
  });
}

function canvasToJpegDataAndBytes(
  canvas: HTMLCanvasElement,
  quality = 0.92
): { dataUrl: string; jpegBytes: Uint8Array } {
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  const commaIdx = dataUrl.indexOf(',');
  const b64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : '';
  const bin = typeof atob === 'function' ? atob(b64) : '';
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return { dataUrl, jpegBytes: bytes };
}

// ============================================================================
// محرك رسم صفحات A4 الرسمي للتقارير الخمسة المعتمدة
// ============================================================================

const A4_W = 1240;
const A4_H = 1754;
const BURGUNDY = '#7F1D3F';
const BURGUNDY_LIGHT = '#F9EFF2';
const BURGUNDY_BORDER = '#E6C7D0';
const CHARCOAL = '#26323B';
const WARM_BG = '#FAF7F5';
const MUTED = '#57534E';

interface A4CanvasDocumentBuilder {
  pages: Array<{
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    links: GiftedPdfLinkAnnotation[];
  }>;
  currentY: number;
  pageIndex: number;
  headerInfo: {
    reportTitle: string;
    reportSubtitle: string;
    educationDepartment: string;
    schoolName: string;
    academicYear: string;
    semesterLabel: string;
  };
  ensureSpace: (neededHeight: number) => void;
  addNewPage: (isCoverPage?: boolean) => void;
  drawSectionTitle: (title: string, badge?: string) => void;
  drawKeyValuePairs: (items: Array<{ label: string; value: string }>) => void;
  drawParagraphBlock: (label: string, text: string) => void;
  drawTable: (headers: string[], rows: string[][], colRatios?: number[]) => void;
  drawVisualEvidencesSection: (
    evidences: ResolvedVisualEvidenceItem[],
    links: Array<{ title: string; url: string; sourceTitle?: string }>
  ) => Promise<void>;
  drawSignoff: (
    coordinatorTitle: string,
    coordinatorName: string,
    principalTitle: string,
    principalName: string
  ) => void;
  finalize: () => {
    renderedPages: GiftedPdfRenderedPage[];
    previewDataUrls: string[];
  };
}

function wrapArabicTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const clean = (text || '').trim();
  if (!clean) return [];
  const paragraphs = clean.split(/\r?\n/);
  const lines: string[] = [];

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;
    const words = trimmed.split(/\s+/);
    let currentLine = '';
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(testLine).width <= maxWidth || !currentLine) {
        currentLine = testLine;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
  }
  return lines;
}

function createA4DocumentBuilder(headerInfo: {
  reportTitle: string;
  reportSubtitle: string;
  educationDepartment: string;
  schoolName: string;
  academicYear: string;
  semesterLabel: string;
  moeLogoImg?: HTMLImageElement | null;
  startWithOfficialCover?: {
    coordinatorTitle: string;
    coordinatorName: string;
    principalTitle: string;
    principalName: string;
  };
}): A4CanvasDocumentBuilder {
  const pages: Array<{
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    links: GiftedPdfLinkAnnotation[];
  }> = [];

  const drawOfficialThreeZoneMaktabiHeader = (
    ctx: CanvasRenderingContext2D,
    topY: number
  ): number => {
    const eduDeptText = hasNonEmptyText(headerInfo.educationDepartment)
      ? headerInfo.educationDepartment
      : 'غير محدد';
    const schoolNameText = hasNonEmptyText(headerInfo.schoolName)
      ? headerInfo.schoolName
      : 'غير محدد';

    ctx.save();
    // 1. الجهة اليمنى: المملكة / وزارة التعليم / الإدارة التعليمية / المدرسة
    ctx.direction = 'rtl';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'right';
    const rightAnchorX = A4_W - 84;

    ctx.fillStyle = '#0c0a09';
    ctx.font = 'bold 21px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
    ctx.fillText('المملكة العربية السعودية', rightAnchorX, topY + 6);

    ctx.fillStyle = '#292524';
    ctx.font = 'bold 19px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
    ctx.fillText('وزارة التعليم', rightAnchorX, topY + 38);

    ctx.fillStyle = '#1c1917';
    ctx.font = '600 17px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
    ctx.fillText(eduDeptText, rightAnchorX, topY + 68);
    ctx.fillText(schoolNameText, rightAnchorX, topY + 96);

    // 2. المنتصف: شعار وزارة التعليم الرسمي المعتمد
    const logoImg = headerInfo.moeLogoImg;
    if (logoImg && logoImg.width > 0 && logoImg.height > 0) {
      const cropX = logoImg.width * 0.26;
      const cropY = logoImg.height * 0.31;
      const cropW = logoImg.width * 0.48;
      const cropH = logoImg.height * 0.38;
      const targetLogoW = 196;
      const targetLogoH = (cropH / cropW) * targetLogoW;
      ctx.drawImage(
        logoImg,
        cropX,
        cropY,
        cropW,
        cropH,
        (A4_W - targetLogoW) / 2,
        topY + (130 - targetLogoH) / 2,
        targetLogoW,
        targetLogoH
      );
    }

    // 3. الجهة اليسرى: الموهوبين + العام الدراسي + الفصل الدراسي
    const leftCenterX = 210;
    ctx.textAlign = 'center';
    ctx.fillStyle = BURGUNDY;
    ctx.font = 'bold 22px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
    ctx.fillText('الموهوبين', leftCenterX, topY + 18);

    ctx.fillStyle = CHARCOAL;
    ctx.font = 'bold 16px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
    ctx.fillText('سجل منسق الموهوبين', leftCenterX, topY + 50);

    ctx.fillStyle = '#1c1917';
    ctx.font = '600 16px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
    ctx.fillText(
      `${headerInfo.academicYear} — ${headerInfo.semesterLabel}`,
      leftCenterX,
      topY + 80
    );

    ctx.restore();

    const dividerY = topY + 138;
    ctx.strokeStyle = BURGUNDY_BORDER;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(68, dividerY);
    ctx.lineTo(A4_W - 68, dividerY);
    ctx.stroke();

    return dividerY + 16;
  };

  const drawPageFrameAndHeader = (
    ctx: CanvasRenderingContext2D,
    isCoverPage = false
  ): number => {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, A4_W, A4_H);

    // الإطار الرسمي المزدوج
    ctx.strokeStyle = BURGUNDY;
    ctx.lineWidth = 3;
    ctx.strokeRect(36, 36, A4_W - 72, A4_H - 72);
    ctx.strokeStyle = BURGUNDY_BORDER;
    ctx.lineWidth = 1;
    ctx.strokeRect(44, 44, A4_W - 88, A4_H - 88);

    // الكليشة والترويسة الرسمية الموحدة في أعلى كل صفحة
    const afterKaleeshahY = drawOfficialThreeZoneMaktabiHeader(ctx, 56);

    if (isCoverPage && headerInfo.startWithOfficialCover) {
      // رسم الغلاف الرسمي (القسم ١ من التقرير الختامي) أسفل الكليشة الرسمية
      const bannerY = afterKaleeshahY;
      ctx.fillStyle = BURGUNDY;
      ctx.fillRect(68, bannerY, A4_W - 136, 132);

      ctx.direction = 'rtl';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 30px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
      ctx.fillText(headerInfo.reportTitle, A4_W / 2, bannerY + 54);
      ctx.font = '500 17px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
      ctx.fillText(
        `العام الدراسي: ${headerInfo.academicYear} — ${headerInfo.semesterLabel}`,
        A4_W / 2,
        bannerY + 96
      );

      // بطاقة بيانات الغلاف الرسمي
      const cardY = bannerY + 150;
      ctx.fillStyle = WARM_BG;
      ctx.fillRect(68, cardY, A4_W - 136, 146);
      ctx.strokeStyle = BURGUNDY_BORDER;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(68, cardY, A4_W - 136, 146);

      ctx.textAlign = 'right';
      ctx.fillStyle = BURGUNDY;
      ctx.font = 'bold 20px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
      ctx.fillText('١. الغلاف الرسمي للسجل', A4_W - 92, cardY + 38);

      ctx.fillStyle = CHARCOAL;
      ctx.font = 'bold 17px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
      const cov = headerInfo.startWithOfficialCover;
      ctx.fillText(
        `${cov.coordinatorTitle}: ${cov.coordinatorName || 'غير محدد'}`,
        A4_W - 92,
        cardY + 80
      );
      ctx.fillText(
        `${cov.principalTitle}: ${cov.principalName || 'غير محدد'}`,
        A4_W - 92,
        cardY + 118
      );
      ctx.textAlign = 'left';
      ctx.fillText(
        `العام الدراسي: ${headerInfo.academicYear} | ${headerInfo.semesterLabel}`,
        92,
        cardY + 80
      );

      return cardY + 170;
    }

    // شريط عنوان التقرير أسفل الكليشة الرسمية
    const titleBannerY = afterKaleeshahY;
    ctx.fillStyle = WARM_BG;
    ctx.fillRect(68, titleBannerY, A4_W - 136, 72);
    ctx.strokeStyle = BURGUNDY_BORDER;
    ctx.lineWidth = 1;
    ctx.strokeRect(68, titleBannerY, A4_W - 136, 72);
    ctx.fillStyle = BURGUNDY;
    ctx.fillRect(A4_W - 76, titleBannerY, 8, 72);

    ctx.direction = 'rtl';
    ctx.textAlign = 'right';
    ctx.fillStyle = CHARCOAL;
    ctx.font = 'bold 22px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
    ctx.fillText(headerInfo.reportTitle, A4_W - 96, titleBannerY + 32);

    if (hasNonEmptyText(headerInfo.reportSubtitle)) {
      ctx.fillStyle = MUTED;
      ctx.font = '500 14px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
      ctx.fillText(headerInfo.reportSubtitle, A4_W - 96, titleBannerY + 58);
    }

    return titleBannerY + 90;
  };

  const builder: A4CanvasDocumentBuilder = {
    pages,
    currentY: 212,
    pageIndex: 0,
    headerInfo,
    addNewPage(isCoverPage = false) {
      const canvas = document.createElement('canvas');
      canvas.width = A4_W;
      canvas.height = A4_H;
      const ctx = canvas.getContext('2d')!;
      const startY = drawPageFrameAndHeader(ctx, isCoverPage);
      pages.push({ canvas, ctx, links: [] });
      this.pageIndex = pages.length - 1;
      this.currentY = startY;
    },
    ensureSpace(neededHeight: number) {
      if (this.currentY + neededHeight > A4_H - 110) {
        this.addNewPage(false);
      }
    },
    drawSectionTitle(title: string, badge?: string) {
      this.ensureSpace(64);
      const { ctx } = pages[this.pageIndex];
      const y = this.currentY;

      ctx.fillStyle = BURGUNDY_LIGHT;
      ctx.fillRect(68, y, A4_W - 136, 44);
      ctx.fillStyle = BURGUNDY;
      ctx.fillRect(A4_W - 76, y, 8, 44);

      ctx.direction = 'rtl';
      ctx.textAlign = 'right';
      ctx.fillStyle = BURGUNDY;
      ctx.font = 'bold 18px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
      ctx.fillText(title, A4_W - 92, y + 29);

      if (hasNonEmptyText(badge)) {
        ctx.textAlign = 'left';
        ctx.fillStyle = CHARCOAL;
        ctx.font = 'bold 14px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
        ctx.fillText(badge, 84, y + 28);
      }

      this.currentY = y + 58;
    },
    drawKeyValuePairs(items: Array<{ label: string; value: string }>) {
      const nonEmpty = items.filter(
        (it) => hasNonEmptyText(it.label) && hasNonEmptyText(it.value)
      );
      if (nonEmpty.length === 0) return;

      const rowsCount = Math.ceil(nonEmpty.length / 2);
      const rowH = 54;
      this.ensureSpace(rowsCount * rowH + 16);

      const { ctx } = pages[this.pageIndex];
      const startX = 68;
      const totalW = A4_W - 136;
      const colW = (totalW - 16) / 2;

      for (let r = 0; r < rowsCount; r++) {
        const y = this.currentY + r * rowH;
        const rightItem = nonEmpty[r * 2];
        const leftItem = nonEmpty[r * 2 + 1];

        if (rightItem) {
          const rx = startX + colW + 16;
          ctx.fillStyle = WARM_BG;
          ctx.fillRect(rx, y, colW, rowH - 8);
          ctx.strokeStyle = BURGUNDY_BORDER;
          ctx.lineWidth = 1;
          ctx.strokeRect(rx, y, colW, rowH - 8);

          ctx.direction = 'rtl';
          ctx.textAlign = 'right';
          ctx.fillStyle = MUTED;
          ctx.font = 'bold 13px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
          ctx.fillText(`${rightItem.label}:`, rx + colW - 14, y + 19);

          ctx.fillStyle = CHARCOAL;
          ctx.font = 'bold 15px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
          ctx.fillText(
            rightItem.value.slice(0, 68),
            rx + colW - 14,
            y + 39
          );
        }

        if (leftItem) {
          const lx = startX;
          ctx.fillStyle = WARM_BG;
          ctx.fillRect(lx, y, colW, rowH - 8);
          ctx.strokeStyle = BURGUNDY_BORDER;
          ctx.lineWidth = 1;
          ctx.strokeRect(lx, y, colW, rowH - 8);

          ctx.direction = 'rtl';
          ctx.textAlign = 'right';
          ctx.fillStyle = MUTED;
          ctx.font = 'bold 13px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
          ctx.fillText(`${leftItem.label}:`, lx + colW - 14, y + 19);

          ctx.fillStyle = CHARCOAL;
          ctx.font = 'bold 15px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
          ctx.fillText(leftItem.value.slice(0, 68), lx + colW - 14, y + 39);
        }
      }

      this.currentY += rowsCount * rowH + 10;
    },
    drawParagraphBlock(label: string, text: string) {
      if (!hasNonEmptyText(text)) return;
      const { ctx } = pages[this.pageIndex];
      ctx.font = '500 15px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
      const lines = wrapArabicTextLines(ctx, text, A4_W - 180);
      if (lines.length === 0) return;

      const boxH = 38 + lines.length * 24 + 14;
      this.ensureSpace(boxH + 12);

      const activeCtx = pages[this.pageIndex].ctx;
      const y = this.currentY;
      activeCtx.fillStyle = '#FFFFFF';
      activeCtx.fillRect(68, y, A4_W - 136, boxH);
      activeCtx.strokeStyle = BURGUNDY_BORDER;
      activeCtx.lineWidth = 1;
      activeCtx.strokeRect(68, y, A4_W - 136, boxH);

      activeCtx.direction = 'rtl';
      activeCtx.textAlign = 'right';
      activeCtx.fillStyle = BURGUNDY;
      activeCtx.font = 'bold 14px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
      activeCtx.fillText(label, A4_W - 86, y + 24);

      activeCtx.fillStyle = CHARCOAL;
      activeCtx.font = '500 15px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
      lines.forEach((line, idx) => {
        activeCtx.fillText(line, A4_W - 86, y + 50 + idx * 24);
      });

      this.currentY = y + boxH + 10;
    },
    drawTable(headers: string[], rows: string[][], colRatios?: number[]) {
      if (rows.length === 0) return;
      const tableW = A4_W - 136;
      const ratios =
        colRatios && colRatios.length === headers.length
          ? colRatios
          : headers.map(() => 1 / headers.length);
      const colWidths = ratios.map((r) => Math.floor(r * tableW));

      const drawHeaderRow = () => {
        const { ctx } = pages[this.pageIndex];
        const y = this.currentY;
        ctx.fillStyle = CHARCOAL;
        ctx.fillRect(68, y, tableW, 38);

        let rightCursor = A4_W - 68;
        ctx.direction = 'rtl';
        ctx.textAlign = 'right';
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 14px "IBM Plex Sans Arabic", "Tajawal", sans-serif';

        headers.forEach((h, i) => {
          const cw = colWidths[i];
          ctx.fillText(h, rightCursor - 10, y + 24);
          rightCursor -= cw;
        });

        this.currentY = y + 38;
      };

      this.ensureSpace(84);
      drawHeaderRow();

      rows.forEach((row, rIdx) => {
        const rowH = 36;
        if (this.currentY + rowH > A4_H - 110) {
          this.addNewPage(false);
          drawHeaderRow();
        }
        const { ctx } = pages[this.pageIndex];
        const y = this.currentY;

        ctx.fillStyle = rIdx % 2 === 0 ? '#FFFFFF' : WARM_BG;
        ctx.fillRect(68, y, tableW, rowH);
        ctx.strokeStyle = '#E7E5E4';
        ctx.lineWidth = 1;
        ctx.strokeRect(68, y, tableW, rowH);

        let rightCursor = A4_W - 68;
        ctx.direction = 'rtl';
        ctx.textAlign = 'right';
        ctx.fillStyle = CHARCOAL;
        ctx.font = '500 13.5px "IBM Plex Sans Arabic", "Tajawal", sans-serif';

        row.forEach((cellText, cIdx) => {
          const cw = colWidths[cIdx];
          const cleanCell = (cellText || '').trim();
          const maxChars = Math.max(8, Math.floor(cw / 8.5));
          const displayCell =
            cleanCell.length > maxChars
              ? `${cleanCell.slice(0, maxChars - 1)}…`
              : cleanCell;
          ctx.fillText(displayCell, rightCursor - 10, y + 23);
          rightCursor -= cw;
        });

        this.currentY = y + rowH;
      });

      this.currentY += 14;
    },
    async drawVisualEvidencesSection(
      evidences: ResolvedVisualEvidenceItem[],
      links: Array<{ title: string; url: string; sourceTitle?: string }>
    ) {
      // تجميع كافة البطاقات المرئية (صور + صفحات PDF المحولة عبر pdfjs-dist)
      const visualCards: Array<{
        title: string;
        subtitle: string;
        badge: string;
        dataUrl: string;
      }> = [];

      for (const ev of evidences) {
        if (ev.kind === 'image' && ev.imageDataUrl) {
          visualCards.push({
            title: ev.title,
            subtitle: ev.sourceRecordTitle || ev.filename,
            badge: 'صورة شاهد',
            dataUrl: ev.imageDataUrl,
          });
        } else if (ev.kind === 'pdf' && ev.pdfPages && ev.pdfPages.length > 0) {
          for (const pdfPage of ev.pdfPages) {
            visualCards.push({
              title: pdfPage.evidenceTitle || ev.title,
              subtitle: `صفحة ${pdfPage.pageNumber} من ${pdfPage.totalPages} — ${ev.sourceRecordTitle}`,
              badge: `PDF صفحة ${pdfPage.pageNumber}/${pdfPage.totalPages}`,
              dataUrl: pdfPage.dataUrl,
            });
          }
        }
      }

      if (visualCards.length > 0) {
        const cardW = (A4_W - 156) / 2;
        const cardH = 340;

        for (let i = 0; i < visualCards.length; i += 2) {
          this.ensureSpace(cardH + 20);
          const { ctx } = pages[this.pageIndex];
          const y = this.currentY;

          const pair = [visualCards[i], visualCards[i + 1]].filter(Boolean);
          for (let pIdx = 0; pIdx < pair.length; pIdx++) {
            const card = pair[pIdx];
            const x = pIdx === 0 ? A4_W - 68 - cardW : 68;

            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(x, y, cardW, cardH);
            ctx.strokeStyle = BURGUNDY_BORDER;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x, y, cardW, cardH);

            ctx.fillStyle = BURGUNDY_LIGHT;
            ctx.fillRect(x, y, cardW, 56);

            ctx.direction = 'rtl';
            ctx.textAlign = 'right';
            ctx.fillStyle = BURGUNDY;
            ctx.font = 'bold 14px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
            ctx.fillText(card.title.slice(0, 42), x + cardW - 12, y + 24);

            ctx.fillStyle = CHARCOAL;
            ctx.font = '500 12.5px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
            ctx.fillText(card.subtitle.slice(0, 48), x + cardW - 12, y + 46);

            ctx.textAlign = 'left';
            ctx.fillStyle = BURGUNDY;
            ctx.font = 'bold 11.5px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
            ctx.fillText(card.badge, x + 12, y + 24);

            const img = await loadImageElementFromDataUrl(card.dataUrl);
            if (img) {
              const boxX = x + 12;
              const boxY = y + 66;
              const boxW = cardW - 24;
              const boxH = cardH - 78;
              const scale = Math.min(boxW / img.width, boxH / img.height);
              const drawW = img.width * scale;
              const drawH = img.height * scale;
              const drawX = boxX + (boxW - drawW) / 2;
              const drawY = boxY + (boxH - drawH) / 2;
              ctx.drawImage(img, drawX, drawY, drawW, drawH);
            }
          }

          this.currentY = y + cardH + 16;
        }
      }

      // رسم الروابط التفاعلية ورموز QR القابلة للنقر
      const validLinks = links.filter(
        (lnk) => hasNonEmptyText(lnk.title) && hasNonEmptyText(lnk.url)
      );
      if (validLinks.length > 0) {
        const cardW = (A4_W - 156) / 2;
        const cardH = 148;

        for (let i = 0; i < validLinks.length; i += 2) {
          this.ensureSpace(cardH + 16);
          const pageObj = pages[this.pageIndex];
          const { ctx } = pageObj;
          const y = this.currentY;

          const pair = [validLinks[i], validLinks[i + 1]].filter(Boolean);
          for (let pIdx = 0; pIdx < pair.length; pIdx++) {
            const lnk = pair[pIdx];
            const x = pIdx === 0 ? A4_W - 68 - cardW : 68;

            ctx.fillStyle = WARM_BG;
            ctx.fillRect(x, y, cardW, cardH);
            ctx.strokeStyle = BURGUNDY_BORDER;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x, y, cardW, cardH);

            const qrSize = 112;
            const qrX = x + 16;
            const qrY = y + 18;
            drawQrCodeOnCanvas(ctx, lnk.url, qrX, qrY, qrSize, CHARCOAL, '#FFFFFF', 3);

            ctx.direction = 'rtl';
            ctx.textAlign = 'right';
            ctx.fillStyle = BURGUNDY;
            ctx.font = 'bold 15px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
            ctx.fillText(lnk.title.slice(0, 34), x + cardW - 16, y + 40);

            if (hasNonEmptyText(lnk.sourceTitle)) {
              ctx.fillStyle = CHARCOAL;
              ctx.font = '500 13px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
              ctx.fillText(lnk.sourceTitle.slice(0, 38), x + cardW - 16, y + 66);
            }

            ctx.fillStyle = MUTED;
            ctx.font = '500 12px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
            ctx.fillText(lnk.url.slice(0, 40), x + cardW - 16, y + 96);

            ctx.fillStyle = BURGUNDY;
            ctx.font = 'bold 12px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
            ctx.fillText('امسح رمز QR أو انقر لفتح الرابط ↗', x + cardW - 16, y + 124);

            pageObj.links.push({
              pageIndex: this.pageIndex,
              xPx: x,
              yPx: y,
              wPx: cardW,
              hPx: cardH,
              url: lnk.url,
            });
          }

          this.currentY = y + cardH + 14;
        }
      }
    },
    drawSignoff(
      coordinatorTitle: string,
      coordinatorName: string,
      principalTitle: string,
      principalName: string
    ) {
      this.ensureSpace(130);
      const { ctx } = pages[this.pageIndex];
      const y = this.currentY + 12;

      ctx.fillStyle = WARM_BG;
      ctx.fillRect(68, y, A4_W - 136, 96);
      ctx.strokeStyle = BURGUNDY_BORDER;
      ctx.lineWidth = 1;
      ctx.strokeRect(68, y, A4_W - 136, 96);

      ctx.direction = 'rtl';
      ctx.textAlign = 'right';
      ctx.fillStyle = BURGUNDY;
      ctx.font = 'bold 15px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
      ctx.fillText(`إعداد ${coordinatorTitle}:`, A4_W - 96, y + 34);
      ctx.fillStyle = CHARCOAL;
      ctx.font = 'bold 16px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
      ctx.fillText(coordinatorName || 'غير محدد', A4_W - 96, y + 68);

      ctx.textAlign = 'left';
      ctx.fillStyle = BURGUNDY;
      ctx.font = 'bold 15px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
      ctx.fillText(`اعتماد ${principalTitle}:`, 320, y + 34);
      ctx.fillStyle = CHARCOAL;
      ctx.font = 'bold 16px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
      ctx.fillText(principalName || 'غير محدد', 320, y + 68);

      this.currentY = y + 112;
    },
    finalize() {
      const total = pages.length;
      const renderedPages: GiftedPdfRenderedPage[] = [];
      const previewDataUrls: string[] = [];

      pages.forEach((p, idx) => {
        const { ctx, canvas, links } = p;
        // ترقيم الصفحات في التذييل
        ctx.direction = 'rtl';
        ctx.textAlign = 'center';
        ctx.fillStyle = MUTED;
        ctx.font = 'bold 13px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
        ctx.fillText(
          `صفحة ${idx + 1} من ${total} — سجل ${headerInfo.reportTitle}`,
          A4_W / 2,
          A4_H - 54
        );

        const { dataUrl, jpegBytes } = canvasToJpegDataAndBytes(canvas, 0.92);
        previewDataUrls.push(dataUrl);
        renderedPages.push({
          jpegBytes,
          width: A4_W,
          height: A4_H,
          links,
        });
      });

      return { renderedPages, previewDataUrls };
    },
  };

  builder.addNewPage(Boolean(headerInfo.startWithOfficialCover));
  return builder;
}

// ============================================================================
// المكون الرئيسي لمركز التقارير (04 التقارير)
// ============================================================================

export const GiftedReportsEngine: React.FC<GiftedReportsEngineProps> = ({
  record,
  settings,
}) => {
  const gender = settings.gender === 'female' ? 'female' : 'male';
  const terms = useMemo(() => getGiftedGenderedTerms(gender), [gender]);
  const basicInfo = useMemo(
    () => resolveGiftedBasicInfo(record, settings),
    [record, settings]
  );

  const centralAcademicYear = useMemo(
    () => (settings.academicYear || basicInfo.academicYear || '١٤٤٨هـ').trim(),
    [settings.academicYear, basicInfo.academicYear]
  );
  const centralSemester = useMemo<ApprovedSchoolSemester>(
    () => normalizeApprovedSemester(settings.semester),
    [settings.semester]
  );

  // ١. اختيار الفترة للتقارير والتقارير التاريخية (دون تعديل إعدادات مكتبي المركزية)
  const [selectedAcademicYear, setSelectedAcademicYear] =
    useState<string>(centralAcademicYear);
  const [selectedSemester, setSelectedSemester] =
    useState<ApprovedSchoolSemester>(centralSemester);

  // ٢. التبويب النشط من التقارير الخمسة المعتمدة فقط
  const [activeReportKind, setActiveReportKind] =
    useState<ApprovedReportKind>('program_or_initiative_report');

  // ٣. الاختيارات الفرعية للتقرير ١ (برنامج/مبادرة) والتقرير ٢ (طالب)
  const unifiedRecords = useMemo<GiftedUnifiedSection2Record[]>(
    () => record.unifiedRecords ?? [],
    [record.unifiedRecords]
  );
  const students = useMemo<GiftedStudentRecord[]>(
    () => record.students ?? [],
    [record.students]
  );
  const section3Data = useMemo<GiftedSection3Data>(
    () => record.section3Data ?? DEFAULT_SECTION3_DATA,
    [record.section3Data]
  );
  const legacyAdditionalWorks = useMemo<GiftedCoordinatorAdditionalWorkItem[]>(
    () => record.coordinatorAdditionalWorks ?? [],
    [record.coordinatorAdditionalWorks]
  );

  const [selectedProgramRecordId, setSelectedProgramRecordId] =
    useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

  // المرفقات المحملة من IndexedDB وتحويل صفحات PDF عبر pdfjs-dist
  const [activeBlobsMap, setActiveBlobsMap] = useState<
    Record<string, GiftedAttachmentRecord>
  >({});
  const [renderedPdfPagesByBlobKey, setRenderedPdfPagesByBlobKey] = useState<
    Record<string, RenderedPdfPagePreview[]>
  >({});
  const [isLoadingEvidences, setIsLoadingEvidences] = useState<boolean>(false);

  // حالة معاينة وتصدير A4 PDF
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [pdfPreviewPages, setPdfPreviewPages] = useState<string[]>([]);
  const [pdfPreviewTitle, setPdfPreviewTitle] = useState<string>('');

  // قائمة الأعوام الدراسية المتاحة (من الإعدادات المركزية + السجلات المحفوظة + الأعوام التاريخية)
  const availableAcademicYears = useMemo(() => {
    const yearsSet = new Set<string>();
    yearsSet.add(centralAcademicYear);
    ['١٤٤٥هـ', '١٤٤٦هـ', '١٤٤٧هـ', '١٤٤٨هـ', '١٤٤٩هـ'].forEach((y) =>
      yearsSet.add(y)
    );
    students.forEach((s) => {
      if (hasNonEmptyText(s.academicYear)) yearsSet.add(s.academicYear.trim());
    });
    unifiedRecords.forEach((r) => {
      if (hasNonEmptyText(r.academicYear)) yearsSet.add(r.academicYear.trim());
    });
    section3Data.giftedStudentsLog.forEach((r) => {
      if (hasNonEmptyText(r.academicYear)) yearsSet.add(r.academicYear.trim());
    });
    section3Data.programParticipantsLog.forEach((r) => {
      if (hasNonEmptyText(r.academicYear)) yearsSet.add(r.academicYear.trim());
    });
    section3Data.studentAchievementsLog.forEach((r) => {
      if (hasNonEmptyText(r.academicYear)) yearsSet.add(r.academicYear.trim());
    });
    section3Data.meetingsLog.forEach((r) => {
      if (hasNonEmptyText(r.academicYear)) yearsSet.add(r.academicYear.trim());
    });
    section3Data.visitsAndPartnershipsLog.forEach((r) => {
      if (hasNonEmptyText(r.academicYear)) yearsSet.add(r.academicYear.trim());
    });
    section3Data.readyTemplates.forEach((r) => {
      if (hasNonEmptyText(r.academicYear)) yearsSet.add(r.academicYear.trim());
    });
    return Array.from(yearsSet);
  }, [centralAcademicYear, students, unifiedRecords, section3Data]);

  // السجلات الموحدة المطابقة للفترة المختارة
  const periodFilteredUnifiedRecords = useMemo(() => {
    return unifiedRecords.filter((rec) =>
      matchesSelectedPeriod(
        rec.academicYear,
        rec.semester,
        selectedAcademicYear,
        selectedSemester,
        centralAcademicYear,
        centralSemester
      )
    );
  }, [
    unifiedRecords,
    selectedAcademicYear,
    selectedSemester,
    centralAcademicYear,
    centralSemester,
  ]);

  // السجلات المتاحة في قائمة اختيار «تقرير برنامج أو مبادرة» (تقتصر على برنامج ومبادرة فقط دون تقرير)
  const programOrInitiativeRecords = useMemo<GiftedUnifiedSection2Record[]>(
    () =>
      unifiedRecords.filter(
        (r) => r.recordType === 'برنامج' || r.recordType === 'مبادرة'
      ),
    [unifiedRecords]
  );

  // ضبط الاختيار الافتراضي لتقرير البرنامج وتقرير الطالب
  useEffect(() => {
    if (programOrInitiativeRecords.length === 0) {
      setSelectedProgramRecordId('');
      return;
    }
    const exists = programOrInitiativeRecords.some(
      (r) => r.id === selectedProgramRecordId
    );
    if (!exists) {
      const firstInPeriod = periodFilteredUnifiedRecords.find(
        (r) => r.recordType === 'برنامج' || r.recordType === 'مبادرة'
      );
      setSelectedProgramRecordId(
        firstInPeriod ? firstInPeriod.id : programOrInitiativeRecords[0].id
      );
    }
  }, [
    programOrInitiativeRecords,
    periodFilteredUnifiedRecords,
    selectedProgramRecordId,
  ]);

  useEffect(() => {
    if (students.length === 0) {
      setSelectedStudentId('');
      return;
    }
    const exists = students.some((s) => s.id === selectedStudentId);
    if (!exists) {
      setSelectedStudentId(students[0].id);
    }
  }, [students, selectedStudentId]);

  // خريطة الطلاب للوصول السريع بالمعرف
  const studentsById = useMemo(() => {
    const map = new Map<string, GiftedStudentRecord>();
    for (const s of students) {
      map.set(s.id, s);
    }
    return map;
  }, [students]);

  // تحميل المرفقات من IndexedDB وتحويل ملفات PDF إلى صفحات مرئية عبر pdfjs-dist
  useEffect(() => {
    let cancelled = false;
    const loadAndRenderAttachments = async () => {
      setIsLoadingEvidences(true);
      try {
        const repo = getDefaultGiftedAttachmentRepository();
        const allAttachments = await repo.listAttachments();
        const activeList = getActiveGenerationAttachmentsForRecord(
          record,
          allAttachments
        );
        const blobMap: Record<string, GiftedAttachmentRecord> = {};
        for (const att of activeList) {
          blobMap[att.blobKey] = att;
        }
        if (cancelled) return;
        setActiveBlobsMap(blobMap);

        // حصر شواهد الـ PDF وتحويل كل صفحة منها إلى معاينة مرئية عبر pdfjs-dist
        const pdfMap: Record<string, RenderedPdfPagePreview[]> = {};
        for (const rec of unifiedRecords) {
          for (const ev of rec.evidences || []) {
            const blobEntry = blobMap[ev.blobKey];
            if (!blobEntry) continue;
            const isPdf =
              ev.mimeType === 'application/pdf' ||
              blobEntry.mimeType === 'application/pdf' ||
              ev.filename.toLowerCase().endsWith('.pdf');
            if (isPdf && !pdfMap[ev.blobKey]) {
              const pages = await renderPdfAttachmentPagesViaPdfJs({
                bytes: blobEntry.bytes,
                blobKey: ev.blobKey,
                evidenceId: ev.id,
                evidenceTitle: ev.title || ev.filename,
                evidenceCaption: ev.caption,
                sourceRecordTitle: rec.title,
                filename: ev.filename || blobEntry.filename,
              });
              if (cancelled) return;
              pdfMap[ev.blobKey] = pages;
            }
          }
        }

        if (!cancelled) {
          setRenderedPdfPagesByBlobKey(pdfMap);
        }
      } catch {
        // ignore IndexedDB errors in restricted environments
      } finally {
        if (!cancelled) {
          setIsLoadingEvidences(false);
        }
      }
    };

    void loadAndRenderAttachments();
    return () => {
      cancelled = true;
    };
  }, [record, unifiedRecords]);

  // دالة مساعدة لتحويل شواهد سجل موحد إلى عناصر مرئية (صور + صفحات PDF)
  const resolveVisualEvidencesForRecords = useMemo(() => {
    return (targetRecords: GiftedUnifiedSection2Record[]): ResolvedVisualEvidenceItem[] => {
      const items: ResolvedVisualEvidenceItem[] = [];
      const seenBlobKeys = new Set<string>();

      for (const rec of targetRecords) {
        for (const ev of rec.evidences || []) {
          const dedupKey = `${rec.id}::${ev.id}::${ev.blobKey}`;
          if (seenBlobKeys.has(dedupKey)) continue;
          seenBlobKeys.add(dedupKey);

          const blobEntry = activeBlobsMap[ev.blobKey];
          const isPdf =
            ev.mimeType === 'application/pdf' ||
            blobEntry?.mimeType === 'application/pdf' ||
            ev.filename.toLowerCase().endsWith('.pdf');

          if (isPdf) {
            const pages = renderedPdfPagesByBlobKey[ev.blobKey] || [];
            items.push({
              evidenceId: ev.id,
              blobKey: ev.blobKey,
              title: ev.title || ev.filename,
              caption: ev.caption,
              filename: ev.filename,
              mimeType: 'application/pdf',
              sourceRecordId: rec.id,
              sourceRecordTitle: rec.title,
              kind: 'pdf',
              pdfPages: pages.map((p) => ({
                ...p,
                evidenceTitle: ev.title || p.evidenceTitle,
                evidenceCaption: ev.caption,
                sourceRecordTitle: rec.title,
              })),
            });
          } else if (blobEntry) {
            const imgDataUrl = uint8ArrayToDataUrl(
              blobEntry.bytes,
              ev.mimeType || blobEntry.mimeType || 'image/jpeg'
            );
            items.push({
              evidenceId: ev.id,
              blobKey: ev.blobKey,
              title: ev.title || ev.filename,
              caption: ev.caption,
              filename: ev.filename,
              mimeType: ev.mimeType || blobEntry.mimeType || 'image/jpeg',
              sourceRecordId: rec.id,
              sourceRecordTitle: rec.title,
              kind: 'image',
              imageDataUrl: imgDataUrl,
            });
          }
        }
      }
      return items;
    };
  }, [activeBlobsMap, renderedPdfPagesByBlobKey]);

  // ==========================================================================
  // ١. نموذج بيانات «تقرير برنامج أو مبادرة»
  // ==========================================================================
  const selectedProgramRecord = useMemo<GiftedUnifiedSection2Record | null>(() => {
    return (
      programOrInitiativeRecords.find(
        (r) => r.id === selectedProgramRecordId
      ) ??
      programOrInitiativeRecords[0] ??
      null
    );
  }, [programOrInitiativeRecords, selectedProgramRecordId]);

  const selectedProgramVisualEvidences = useMemo(() => {
    if (!selectedProgramRecord) return [];
    return resolveVisualEvidencesForRecords([selectedProgramRecord]);
  }, [selectedProgramRecord, resolveVisualEvidencesForRecords]);

  // ==========================================================================
  // ٢. نموذج بيانات «تقرير طالب» (مع الحفاظ التام على الصف التاريخي ومنع التكرار)
  // ==========================================================================
  const selectedStudent = useMemo<GiftedStudentRecord | null>(() => {
    return (
      students.find((s) => s.id === selectedStudentId) ?? students[0] ?? null
    );
  }, [students, selectedStudentId]);

  const selectedStudentReportData = useMemo(() => {
    if (!selectedStudent) return null;
    const studentId = selectedStudent.id;

    // أ) المشاركات في البرامج والتقارير والمبادرات (القسم 02) بدون تكرار
    const section2Participations: Array<{
      key: string;
      recordId: string;
      recordType: string;
      recordTitle: string;
      dateOrDuration: string;
      academicYear: string;
      semester: string;
      historicalGrade: string;
      scoreOrEvaluation?: string;
      statusRole?: string;
      participationType?: string;
      achievement?: string;
    }> = [];
    const seenSec2Keys = new Set<string>();

    for (const rec of unifiedRecords) {
      for (const p of rec.participants || []) {
        if (p.studentId !== studentId) continue;
        const key = `${rec.id}::${p.studentId}`;
        if (seenSec2Keys.has(key)) continue;
        seenSec2Keys.add(key);

        const dateLabel = [
          hasNonEmptyText(rec.hijriDate) ? rec.hijriDate : '',
          hasNonEmptyText(rec.gregorianDate) ? `(${rec.gregorianDate})` : '',
          !hasNonEmptyText(rec.hijriDate) &&
          !hasNonEmptyText(rec.gregorianDate) &&
          hasNonEmptyText(rec.durationOption)
            ? rec.durationOption
            : '',
        ]
          .filter(Boolean)
          .join(' ');

        section2Participations.push({
          key,
          recordId: rec.id,
          recordType: rec.recordType,
          recordTitle: rec.title,
          dateOrDuration: dateLabel,
          academicYear: rec.academicYear || centralAcademicYear,
          semester: rec.semester || centralSemester,
          // التزام صارم بـ studentGradeAtParticipation وعدم استبداله بالصف الحالي
          historicalGrade:
            hasNonEmptyText(p.studentGradeAtParticipation)
              ? p.studentGradeAtParticipation
              : selectedStudent.grade,
          scoreOrEvaluation: hasNonEmptyText(p.scoreOrEvaluation)
            ? p.scoreOrEvaluation.trim()
            : undefined,
          statusRole: hasNonEmptyText(p.statusRole)
            ? p.statusRole.trim()
            : undefined,
          participationType: hasNonEmptyText(p.participationType)
            ? p.participationType.trim()
            : undefined,
          achievement: hasNonEmptyText(p.achievement)
            ? p.achievement.trim()
            : undefined,
        });
      }
    }

    // ب) سجل الطلاب الموهوبين في القسم 03
    const giftedLogEntries = section3Data.giftedStudentsLog
      .filter((row) => row.studentId === studentId)
      .map((row) => ({
        id: row.id,
        historicalGrade: hasNonEmptyText(row.studentGradeSnapshot)
          ? row.studentGradeSnapshot
          : selectedStudent.grade,
        talentDomain: row.talentDomain,
        notes: hasNonEmptyText(row.notes) ? row.notes : undefined,
        academicYear: row.academicYear,
        semester: row.semester,
      }));

    // ج) سجل الطلاب المشاركين في البرامج في القسم 03 (مع منع تكرار نفس البرنامج والتاريخ)
    const section3ProgramParticipations = section3Data.programParticipantsLog
      .filter((row) => row.studentId === studentId)
      .map((row) => ({
        id: row.id,
        programTitle: row.programTitle,
        historicalGrade: hasNonEmptyText(row.studentGradeSnapshot)
          ? row.studentGradeSnapshot
          : selectedStudent.grade,
        dateLabel: [row.participationHijriDate, row.participationDate]
          .filter(Boolean)
          .join(' — '),
        participationType: hasNonEmptyText(row.participationType)
          ? row.participationType
          : undefined,
      }));

    // د) سجل إنجازات الطالب (من القسم 03 + المشاركات التاريخية) بدون تكرار
    const achievementsList: Array<{
      id: string;
      achievement: string;
      entityOrCompetition: string;
      dateLabel: string;
      historicalGrade: string;
    }> = [];
    const seenAchievementKeys = new Set<string>();

    for (const row of section3Data.studentAchievementsLog) {
      if (row.studentId !== studentId) continue;
      const dedupKey = `${row.achievement.trim()}::${row.entityOrCompetition.trim()}::${row.date}`;
      if (seenAchievementKeys.has(dedupKey)) continue;
      seenAchievementKeys.add(dedupKey);
      achievementsList.push({
        id: row.id,
        achievement: row.achievement,
        entityOrCompetition: row.entityOrCompetition,
        dateLabel: [row.hijriDate, row.date].filter(Boolean).join(' — '),
        historicalGrade: hasNonEmptyText(row.studentGradeSnapshot)
          ? row.studentGradeSnapshot
          : selectedStudent.grade,
      });
    }

    // هـ) المشاركات التاريخية في studentParticipations (إن وجدت وغير مكررة)
    const legacyResolved = resolveStudentParticipationsWithStudentInfo(record).filter(
      (p) => p.studentId === studentId
    );
    const legacyParticipations = legacyResolved.map((p) => ({
      id: p.id,
      categoryLabel: GIFTED_PARTICIPATION_CATEGORY_LABELS[p.category],
      historicalGrade: p.historicalGrade,
      dateLabel: [p.participationHijriDate, p.participationDate]
        .filter(Boolean)
        .join(' — '),
      achievementText: hasNonEmptyText(p.achievementText)
        ? p.achievementText
        : undefined,
      score: hasNonEmptyText(p.score) ? p.score : undefined,
      qualifiedToNextStage: p.qualifiedToNextStage,
    }));

    return {
      student: selectedStudent,
      section2Participations,
      giftedLogEntries,
      section3ProgramParticipations,
      achievementsList,
      legacyParticipations,
    };
  }, [
    selectedStudent,
    unifiedRecords,
    section3Data,
    record,
    centralAcademicYear,
    centralSemester,
  ]);

  // ==========================================================================
  // ٣. نموذج بيانات «تقرير دوري لأعمال المنسق» المرتبط بالفترة المختارة
  // ==========================================================================
  const periodicReportData = useMemo(() => {
    const filterByPeriod = <
      T extends { academicYear?: string; semester?: ApprovedSchoolSemester }
    >(
      items: T[]
    ): T[] =>
      items.filter((item) =>
        matchesSelectedPeriod(
          item.academicYear,
          item.semester,
          selectedAcademicYear,
          selectedSemester,
          centralAcademicYear,
          centralSemester
        )
      );

    const periodProgramsAndRecords = periodFilteredUnifiedRecords;
    const periodGiftedStudentsLog = filterByPeriod(
      section3Data.giftedStudentsLog
    );
    const periodProgramParticipantsLog = filterByPeriod(
      section3Data.programParticipantsLog
    );
    const periodStudentAchievementsLog = filterByPeriod(
      section3Data.studentAchievementsLog
    );
    const periodMeetingsLog = filterByPeriod(section3Data.meetingsLog);
    const periodVisitsLog = filterByPeriod(
      section3Data.visitsAndPartnershipsLog
    );
    const periodReadyTemplates = filterByPeriod(section3Data.readyTemplates);
    const periodEvidences = resolveVisualEvidencesForRecords(
      periodProgramsAndRecords
    );

    return {
      academicYear: selectedAcademicYear,
      semester: selectedSemester,
      periodProgramsAndRecords,
      periodGiftedStudentsLog,
      periodProgramParticipantsLog,
      periodStudentAchievementsLog,
      periodMeetingsLog,
      periodVisitsLog,
      periodReadyTemplates,
      periodEvidences,
      legacyAdditionalWorks,
    };
  }, [
    periodFilteredUnifiedRecords,
    section3Data,
    selectedAcademicYear,
    selectedSemester,
    centralAcademicYear,
    centralSemester,
    resolveVisualEvidencesForRecords,
    legacyAdditionalWorks,
  ]);

  // ==========================================================================
  // ٤. نموذج بيانات «التقرير الإحصائي للطلاب» (مع الالتزام بمعادلات المؤشرات وفصل البرامج الوزارية)
  // ==========================================================================
  const kpiSummary = useMemo(
    () => computeGiftedCompletionMetrics(record),
    [record]
  );
  const baseStatisticalModel = useMemo(
    () => buildGiftedStatisticalReportModel(record, settings),
    [record, settings]
  );

  const studentStatisticalReportData = useMemo(() => {
    // ١. إحصاءات السجل المركزي للطلاب بدون تكرار
    const uniqueStudentsMap = new Map<string, GiftedStudentRecord>();
    for (const st of students) {
      if (!uniqueStudentsMap.has(st.id)) {
        uniqueStudentsMap.set(st.id, st);
      }
    }
    const allCentralStudents = Array.from(uniqueStudentsMap.values());

    // طلاب الفترة المختارة
    const periodStudents = allCentralStudents.filter((st) =>
      matchesSelectedPeriod(
        st.academicYear,
        st.semester,
        selectedAcademicYear,
        selectedSemester,
        centralAcademicYear,
        centralSemester
      )
    );

    // التوزيع حسب الصف الدراسي (من السجل المركزي)
    const gradeCountsMap = new Map<string, number>();
    for (const st of allCentralStudents) {
      const g = hasNonEmptyText(st.grade) ? st.grade.trim() : 'غير محدد';
      gradeCountsMap.set(g, (gradeCountsMap.get(g) ?? 0) + 1);
    }
    const distributionByGrade = Array.from(gradeCountsMap.entries()).map(
      ([grade, count]) => ({
        grade,
        count,
        percentage:
          allCentralStudents.length > 0
            ? Math.round((count / allCentralStudents.length) * 100)
            : 0,
      })
    );

    // التوزيع حسب الجنس (طالب / طالبة)
    let maleCount = 0;
    let femaleCount = 0;
    for (const st of allCentralStudents) {
      if (st.gender === 'طالبة') femaleCount++;
      else maleCount++;
    }

    // ٢. فصل إحصاءات البرامج الوزارية عن المسابقات والمبادرات (دون خلط أو ازدواجية)
    const ministerialProgramsStats = {
      applicableMinisterialProgramsCount: kpiSummary.applicableProgramsCount,
      ministerialTotalActionsCount: kpiSummary.programActionsMetrics.totalActive,
      ministerialExecutedActionsCount: kpiSummary.programActionsMetrics.executed,
      ministerialActionsCompletionPct:
        kpiSummary.programActionsMetrics.completionPercentage,
      unifiedMinisterialScopeProgramsCount: unifiedRecords.filter(
        (r) =>
          r.recordType === 'برنامج' &&
          r.programFields?.executionScope === 'وزاري'
      ).length,
      unifiedEducationDeptProgramsCount: unifiedRecords.filter(
        (r) =>
          r.recordType === 'برنامج' &&
          r.programFields?.executionScope === 'إدارة تعليم'
      ).length,
      unifiedSchoolScopeProgramsCount: unifiedRecords.filter(
        (r) =>
          r.recordType === 'برنامج' &&
          r.programFields?.executionScope === 'مدرسة'
      ).length,
    };

    const initiativesAndCompetitionsStats = {
      unifiedInitiativesCount: unifiedRecords.filter(
        (r) => r.recordType === 'مبادرة'
      ).length,
      unifiedReportsCount: unifiedRecords.filter(
        (r) => r.recordType === 'تقرير'
      ).length,
      customInitiativesTotal: kpiSummary.customInitiativesMetrics.totalActive,
      customInitiativesExecuted: kpiSummary.customInitiativesMetrics.executed,
      scientificCompetitionsTotal: kpiSummary.competitionsMetrics.totalActive,
      scientificCompetitionsExecuted: kpiSummary.competitionsMetrics.executed,
    };

    // ٣. حساب الطلاب المستفيدين والمشاركات والإنجازات دون ازدواجية
    const beneficiaryStudentIds = new Set<string>();
    const uniqueParticipationPairs = new Set<string>();
    const uniqueAchievementKeys = new Set<string>();

    for (const rec of unifiedRecords) {
      for (const p of rec.participants || []) {
        if (uniqueStudentsMap.has(p.studentId)) {
          beneficiaryStudentIds.add(p.studentId);
          uniqueParticipationPairs.add(`sec2::${rec.id}::${p.studentId}`);
          if (hasNonEmptyText(p.achievement)) {
            uniqueAchievementKeys.add(
              `${p.studentId}::${p.achievement.trim()}`
            );
          }
        }
      }
    }

    for (const row of section3Data.programParticipantsLog) {
      if (uniqueStudentsMap.has(row.studentId)) {
        beneficiaryStudentIds.add(row.studentId);
        const key = row.linkedRecordId
          ? `sec2::${row.linkedRecordId}::${row.studentId}`
          : `sec3prog::${row.programTitle.trim()}::${row.studentId}`;
        uniqueParticipationPairs.add(key);
      }
    }

    for (const row of section3Data.studentAchievementsLog) {
      if (uniqueStudentsMap.has(row.studentId)) {
        beneficiaryStudentIds.add(row.studentId);
        uniqueAchievementKeys.add(
          `${row.studentId}::${row.achievement.trim()}`
        );
      }
    }

    for (const p of record.studentParticipations || []) {
      if (uniqueStudentsMap.has(p.studentId)) {
        beneficiaryStudentIds.add(p.studentId);
        uniqueParticipationPairs.add(`legacy::${p.category}::${p.studentId}`);
        if (hasNonEmptyText(p.achievementText)) {
          uniqueAchievementKeys.add(
            `${p.studentId}::${p.achievementText.trim()}`
          );
        }
      }
    }

    return {
      totalCentralStudents: allCentralStudents.length,
      periodStudentsCount: periodStudents.length,
      uniqueBeneficiaryStudentsCount: beneficiaryStudentIds.size,
      deduplicatedParticipationsCount: uniqueParticipationPairs.size,
      deduplicatedAchievementsCount: uniqueAchievementKeys.size,
      maleCount,
      femaleCount,
      distributionByGrade,
      ministerialProgramsStats,
      initiativesAndCompetitionsStats,
      kpiSummary,
      baseStatisticalModel,
    };
  }, [
    students,
    selectedAcademicYear,
    selectedSemester,
    centralAcademicYear,
    centralSemester,
    kpiSummary,
    baseStatisticalModel,
    unifiedRecords,
    section3Data,
    record.studentParticipations,
  ]);

  // ==========================================================================
  // ٥. جميع الشواهد والروابط المجمعة للتقرير الختامي للسجل (بدون تكرار)
  // ==========================================================================
  const allFinalReportVisualEvidences = useMemo(
    () => resolveVisualEvidencesForRecords(unifiedRecords),
    [resolveVisualEvidencesForRecords, unifiedRecords]
  );

  const allFinalReportLinks = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      url: string;
      sourceTitle: string;
    }> = [];
    const seenUrls = new Set<string>();
    for (const rec of unifiedRecords) {
      for (const lnk of rec.links || []) {
        if (!hasNonEmptyText(lnk.url) || !hasNonEmptyText(lnk.title)) continue;
        const key = `${rec.id}::${lnk.url.trim()}`;
        if (seenUrls.has(key)) continue;
        seenUrls.add(key);
        list.push({
          id: lnk.id,
          title: lnk.title,
          url: lnk.url,
          sourceTitle: rec.title,
        });
      }
    }
    return list;
  }, [unifiedRecords]);

  // ==========================================================================
  // ٦. بناء وتصدير صفحات A4 PDF للتقارير الخمسة المعتمدة
  // ==========================================================================
  const buildCurrentReportPdfPages = async (): Promise<{
    renderedPages: GiftedPdfRenderedPage[];
    previewDataUrls: string[];
    filename: string;
    title: string;
  }> => {
    const safeSchool = sanitizeFilenameSegment(
      basicInfo.schoolName || 'مكتبي'
    );
    const safeYear = sanitizeFilenameSegment(selectedAcademicYear);
    const moeLogoImg = await loadOfficialMinistryLogoForReports();

    if (activeReportKind === 'program_or_initiative_report') {
      const rec = selectedProgramRecord;
      const reportTitle = rec
        ? `تقرير ${rec.recordType}: ${rec.title}`
        : 'تقرير برنامج أو مبادرة';
      const builder = createA4DocumentBuilder({
        reportTitle,
        reportSubtitle: 'تقرير برنامج أو مبادرة من سجل الموهوبين',
        educationDepartment: basicInfo.educationDepartment,
        schoolName: basicInfo.schoolName,
        academicYear: rec?.academicYear || selectedAcademicYear,
        semesterLabel: rec?.semester || selectedSemester,
        moeLogoImg,
      });

      if (!rec) {
        builder.drawSectionTitle('لا يوجد سجل محدد');
      } else {
        builder.drawSectionTitle(
          `أولاً: البيانات الأساسية (${rec.recordType})`,
          `${rec.academicYear} — ${rec.semester}`
        );

        const dateOrDuration = [
          hasNonEmptyText(rec.hijriDate) ? `هجري: ${rec.hijriDate}` : '',
          hasNonEmptyText(rec.gregorianDate)
            ? `ميلادي: ${rec.gregorianDate}`
            : '',
          !hasNonEmptyText(rec.hijriDate) &&
          !hasNonEmptyText(rec.gregorianDate) &&
          hasNonEmptyText(rec.durationOption)
            ? `المدة: ${rec.durationOption}`
            : '',
        ]
          .filter(Boolean)
          .join(' | ');

        const kvPairs: Array<{ label: string; value: string }> = [
          { label: 'نوع السجل', value: rec.recordType },
          { label: 'العنوان', value: rec.title },
          { label: 'التاريخ / المدة', value: dateOrDuration },
          { label: 'العام الدراسي', value: rec.academicYear },
          { label: 'الفصل الدراسي', value: rec.semester },
        ];
        if (hasNonEmptyText(rec.location)) {
          kvPairs.push({ label: 'الموقع', value: rec.location });
        }
        if (rec.recordType === 'برنامج' && rec.programFields) {
          kvPairs.push({
            label: 'نطاق التنفيذ',
            value: rec.programFields.executionScope,
          });
          if (hasNonEmptyText(rec.programFields.programTypeOrField)) {
            kvPairs.push({
              label: 'نوع البرنامج أو مجاله',
              value: rec.programFields.programTypeOrField,
            });
          }
          if (hasNonEmptyText(rec.programFields.targetAudience)) {
            kvPairs.push({
              label: 'الفئة المستهدفة',
              value: rec.programFields.targetAudience,
            });
          }
          if (hasNonEmptyText(rec.programFields.executingEntity)) {
            kvPairs.push({
              label: 'الجهة المنفذة',
              value: rec.programFields.executingEntity,
            });
          }
        }
        if (
          rec.recordType === 'مبادرة' &&
          rec.initiativeFields &&
          hasNonEmptyText(rec.initiativeFields.targetAudience)
        ) {
          kvPairs.push({
            label: 'الفئة المستهدفة',
            value: rec.initiativeFields.targetAudience,
          });
        }
        builder.drawKeyValuePairs(kvPairs);

        if (hasNonEmptyText(rec.description)) {
          builder.drawParagraphBlock('الوصف العام', rec.description);
        }

        if (rec.recordType === 'برنامج' && rec.programFields) {
          builder.drawParagraphBlock('الهدف', rec.programFields.objective);
          builder.drawParagraphBlock('النتائج', rec.programFields.results);
          builder.drawParagraphBlock(
            'الملاحظات والتوصيات',
            rec.programFields.notesAndRecommendations
          );
        } else if (rec.recordType === 'تقرير' && rec.reportFields) {
          builder.drawParagraphBlock(
            'أهداف التقرير',
            rec.reportFields.reportObjectives
          );
          builder.drawParagraphBlock(
            'النتائج والمخرجات',
            rec.reportFields.resultsAndOutputs
          );
          builder.drawParagraphBlock(
            'مؤشرات التحقق',
            rec.reportFields.achievementIndicators
          );
          builder.drawParagraphBlock(
            'التحديات والصعوبات',
            rec.reportFields.challengesAndDifficulties
          );
          builder.drawParagraphBlock(
            'التوصيات والمقترحات',
            rec.reportFields.recommendationsAndProposals
          );
          builder.drawParagraphBlock('ملاحظات', rec.reportFields.notes);
        } else if (rec.recordType === 'مبادرة' && rec.initiativeFields) {
          builder.drawParagraphBlock(
            'فكرة المبادرة',
            rec.initiativeFields.initiativeIdea
          );
          builder.drawParagraphBlock(
            'أهداف المبادرة',
            rec.initiativeFields.initiativeObjectives
          );
          builder.drawParagraphBlock(
            'خطوات التنفيذ',
            rec.initiativeFields.executionSteps
          );
          builder.drawParagraphBlock(
            'النتائج والأثر',
            rec.initiativeFields.resultsAndImpact
          );
          builder.drawParagraphBlock(
            'التحديات',
            rec.initiativeFields.challenges
          );
          builder.drawParagraphBlock(
            'التوصيات',
            rec.initiativeFields.recommendations
          );
        }

        if (rec.participants && rec.participants.length > 0) {
          builder.drawSectionTitle(
            `ثانياً: الطلاب المشاركون (${rec.participants.length})`
          );
          const hasAnyScore = rec.participants.some((p) =>
            hasNonEmptyText(p.scoreOrEvaluation)
          );
          const hasAnyRole = rec.participants.some((p) =>
            hasNonEmptyText(p.statusRole)
          );
          const hasAnyType = rec.participants.some((p) =>
            hasNonEmptyText(p.participationType)
          );
          const hasAnyAch = rec.participants.some((p) =>
            hasNonEmptyText(p.achievement)
          );

          const headers = ['م', 'الاسم الرباعي', 'الصف وقت المشاركة'];
          if (hasAnyRole) headers.push('الصفة / الحالة');
          if (hasAnyType) headers.push('نوع المشاركة');
          if (hasAnyScore) headers.push('الدرجة / التقييم');
          if (hasAnyAch) headers.push('الإنجاز');

          const rows = rec.participants.map((p, idx) => {
            const st = studentsById.get(p.studentId);
            const row = [
              String(idx + 1),
              st?.name || 'طالب مسجل',
              hasNonEmptyText(p.studentGradeAtParticipation)
                ? p.studentGradeAtParticipation
                : st?.grade || '',
            ];
            if (hasAnyRole) row.push(p.statusRole || '');
            if (hasAnyType) row.push(p.participationType || '');
            if (hasAnyScore) row.push(p.scoreOrEvaluation || '');
            if (hasAnyAch) row.push(p.achievement || '');
            return row;
          });
          builder.drawTable(headers, rows);
        }

        if (
          selectedProgramVisualEvidences.length > 0 ||
          (rec.links && rec.links.length > 0)
        ) {
          builder.drawSectionTitle('ثالثاً: الشواهد والمرفقات والروابط');
          await builder.drawVisualEvidencesSection(
            selectedProgramVisualEvidences,
            (rec.links || []).map((l) => ({
              title: l.title,
              url: l.url,
              sourceTitle: rec.title,
            }))
          );
        }
      }

      builder.drawSignoff(
        basicInfo.coordinatorTitle,
        basicInfo.coordinatorName,
        basicInfo.principalTitle,
        basicInfo.principalName
      );
      const { renderedPages, previewDataUrls } = builder.finalize();
      return {
        renderedPages,
        previewDataUrls,
        filename: `تقرير_برنامج_او_مبادرة_${safeSchool}_${safeYear}.pdf`,
        title: reportTitle,
      };
    }

    if (activeReportKind === 'student_report') {
      const stData = selectedStudentReportData;
      const reportTitle = stData
        ? `تقرير الطالب: ${stData.student.name}`
        : 'تقرير طالب';
      const builder = createA4DocumentBuilder({
        reportTitle,
        reportSubtitle: 'بطاقة السجل المركزي والمشاركات التاريخية والإنجازات',
        educationDepartment: basicInfo.educationDepartment,
        schoolName: basicInfo.schoolName,
        academicYear: selectedAcademicYear,
        semesterLabel: selectedSemester,
        moeLogoImg,
      });

      if (stData) {
        const st = stData.student;
        builder.drawSectionTitle('أولاً: البيانات المركزية للطالب');
        const kv: Array<{ label: string; value: string }> = [
          { label: 'الاسم الرباعي', value: st.name },
          { label: 'رقم الهوية الوطنية', value: st.civilId || '' },
          { label: 'الجنس', value: st.gender || '' },
          { label: 'الصف الحالي بالسجل', value: st.grade },
          {
            label: 'العام الدراسي',
            value: st.academicYear || centralAcademicYear,
          },
          {
            label: 'الفصل الدراسي',
            value: st.semester || centralSemester,
          },
        ];
        if (hasNonEmptyText(st.studentMobile)) {
          kv.push({ label: 'جوال الطالب', value: st.studentMobile });
        }
        if (hasNonEmptyText(st.guardianName)) {
          kv.push({ label: 'اسم ولي الأمر', value: st.guardianName });
        }
        builder.drawKeyValuePairs(kv);

        if (stData.section2Participations.length > 0) {
          builder.drawSectionTitle(
            `ثانياً: المشاركات في البرامج والتقارير والمبادرات (${stData.section2Participations.length})`
          );
          const hasRole = stData.section2Participations.some((p) =>
            hasNonEmptyText(p.statusRole)
          );
          const hasType = stData.section2Participations.some((p) =>
            hasNonEmptyText(p.participationType)
          );
          const hasScore = stData.section2Participations.some((p) =>
            hasNonEmptyText(p.scoreOrEvaluation)
          );
          const hasAch = stData.section2Participations.some((p) =>
            hasNonEmptyText(p.achievement)
          );

          const headers = [
            'نوع السجل',
            'العنوان',
            'الصف وقت المشاركة',
            'الفترة / التاريخ',
          ];
          if (hasRole) headers.push('الصفة');
          if (hasType) headers.push('نوع المشاركة');
          if (hasScore) headers.push('الدرجة / التقييم');
          if (hasAch) headers.push('الإنجاز');

          const rows = stData.section2Participations.map((p) => {
            const r = [
              p.recordType,
              p.recordTitle,
              p.historicalGrade,
              `${p.academicYear} — ${p.semester}`,
            ];
            if (hasRole) r.push(p.statusRole || '');
            if (hasType) r.push(p.participationType || '');
            if (hasScore) r.push(p.scoreOrEvaluation || '');
            if (hasAch) r.push(p.achievement || '');
            return r;
          });
          builder.drawTable(headers, rows);
        }

        if (stData.achievementsList.length > 0) {
          builder.drawSectionTitle(
            `ثالثاً: سجل إنجازات الطالب (${stData.achievementsList.length})`
          );
          builder.drawTable(
            ['الإنجاز', 'الجهة أو المسابقة', 'الصف التاريخي', 'التاريخ'],
            stData.achievementsList.map((a) => [
              a.achievement,
              a.entityOrCompetition,
              a.historicalGrade,
              a.dateLabel,
            ])
          );
        }

        if (
          stData.giftedLogEntries.length > 0 ||
          stData.section3ProgramParticipations.length > 0
        ) {
          builder.drawSectionTitle('رابعاً: السجلات المرتبطة في النماذج الأخرى');
          if (stData.giftedLogEntries.length > 0) {
            builder.drawTable(
              ['مجال الموهبة', 'الصف التاريخي', 'ملاحظات'],
              stData.giftedLogEntries.map((g) => [
                g.talentDomain,
                g.historicalGrade,
                g.notes || '',
              ])
            );
          }
          if (stData.section3ProgramParticipations.length > 0) {
            builder.drawTable(
              ['البرنامج', 'الصف التاريخي', 'نوع المشاركة', 'تاريخ المشاركة'],
              stData.section3ProgramParticipations.map((p) => [
                p.programTitle,
                p.historicalGrade,
                p.participationType || '',
                p.dateLabel,
              ])
            );
          }
        }
      }

      builder.drawSignoff(
        basicInfo.coordinatorTitle,
        basicInfo.coordinatorName,
        basicInfo.principalTitle,
        basicInfo.principalName
      );
      const { renderedPages, previewDataUrls } = builder.finalize();
      return {
        renderedPages,
        previewDataUrls,
        filename: `تقرير_طالب_${safeSchool}_${safeYear}.pdf`,
        title: reportTitle,
      };
    }

    if (activeReportKind === 'periodic_coordinator_report') {
      const reportTitle = `تقرير دوري لأعمال ${terms.coordinatorSingular}`;
      const builder = createA4DocumentBuilder({
        reportTitle,
        reportSubtitle: `الفترة: ${selectedAcademicYear} — ${selectedSemester}`,
        educationDepartment: basicInfo.educationDepartment,
        schoolName: basicInfo.schoolName,
        academicYear: selectedAcademicYear,
        semesterLabel: selectedSemester,
        moeLogoImg,
      });

      builder.drawSectionTitle(
        `أولاً: البرامج والتقارير والمبادرات للفترة المختارة (${periodicReportData.periodProgramsAndRecords.length})`
      );
      if (periodicReportData.periodProgramsAndRecords.length > 0) {
        builder.drawTable(
          ['النوع', 'العنوان', 'التاريخ / المدة', 'عدد المشاركين'],
          periodicReportData.periodProgramsAndRecords.map((r) => [
            r.recordType,
            r.title,
            r.hijriDate || r.gregorianDate || r.durationOption || '',
            String((r.participants || []).length),
          ])
        );
      }

      builder.drawSectionTitle('ثانياً: السجلات الخمسة والنماذج الجاهزة للفترة');
      if (periodicReportData.periodMeetingsLog.length > 0) {
        builder.drawTable(
          ['تاريخ الاجتماع', 'موضوع الاجتماع', 'عدد الحضور', 'أبرز التوصيات'],
          periodicReportData.periodMeetingsLog.map((m) => [
            m.hijriDate || m.date,
            m.topic,
            String((m.attendees || []).length),
            m.keyRecommendations,
          ])
        );
      }
      if (periodicReportData.periodVisitsLog.length > 0) {
        builder.drawTable(
          ['الجهة أو المكان', 'التاريخ', 'الغرض', 'أبرز النتائج'],
          periodicReportData.periodVisitsLog.map((v) => [
            v.entityOrPlace,
            v.hijriDate || v.date,
            v.purpose,
            v.keyResults,
          ])
        );
      }
      if (periodicReportData.periodReadyTemplates.length > 0) {
        builder.drawTable(
          ['نوع النموذج', 'العنوان', 'الموضوع / الغرض', 'التاريخ'],
          periodicReportData.periodReadyTemplates.map((t) => [
            t.templateKind,
            t.title,
            t.subjectOrPurpose,
            t.hijriDate || t.date,
          ])
        );
      }

      if (periodicReportData.periodEvidences.length > 0) {
        builder.drawSectionTitle('ثالثاً: شواهد ومرفقات الفترة');
        await builder.drawVisualEvidencesSection(
          periodicReportData.periodEvidences,
          []
        );
      }

      if (periodicReportData.legacyAdditionalWorks.length > 0) {
        builder.drawSectionTitle(
          `رابعاً: أرشيف الأعمال الإضافية السابق (${periodicReportData.legacyAdditionalWorks.length})`
        );
        builder.drawTable(
          ['نوع العمل', 'التاريخ', 'الأسبوع', 'الملخص'],
          periodicReportData.legacyAdditionalWorks.map((w) => [
            GIFTED_COORDINATOR_WORK_KIND_LABELS[w.workKind],
            w.hijriDate || w.executionDate,
            w.weekLabel,
            w.summary,
          ])
        );
      }

      builder.drawSignoff(
        basicInfo.coordinatorTitle,
        basicInfo.coordinatorName,
        basicInfo.principalTitle,
        basicInfo.principalName
      );
      const { renderedPages, previewDataUrls } = builder.finalize();
      return {
        renderedPages,
        previewDataUrls,
        filename: `تقرير_دوري_لاعمال_المنسق_${safeSchool}_${safeYear}.pdf`,
        title: reportTitle,
      };
    }

    if (activeReportKind === 'final_record_report') {
      const reportTitle = `التقرير الختامي لسجل ${terms.coordinatorSingular}`;
      const builder = createA4DocumentBuilder({
        reportTitle,
        reportSubtitle: 'التقرير الختامي الشامل بالأقسام السبعة المعتمدة',
        educationDepartment: basicInfo.educationDepartment,
        schoolName: basicInfo.schoolName,
        academicYear: selectedAcademicYear,
        semesterLabel: selectedSemester,
        moeLogoImg,
        startWithOfficialCover: {
          coordinatorTitle: basicInfo.coordinatorTitle,
          coordinatorName: basicInfo.coordinatorName,
          principalTitle: basicInfo.principalTitle,
          principalName: basicInfo.principalName,
        },
      });

      // القسم ٢: الفهرس
      builder.drawSectionTitle('٢. الفهرس العام للتقرير الختامي');
      builder.drawTable(
        ['رقم القسم', 'عنوان القسم المعتمد', 'الوصف والمحتوى'],
        FINAL_REPORT_SEVEN_APPROVED_SECTIONS.map((sec) => [
          sec.number,
          sec.title,
          sec.id === 'cover'
            ? 'بيانات المدرسة والعام الدراسي والفصل الدراسي والمنسق والمدير'
            : sec.id === 'toc'
              ? 'فهرس الأقسام السبعة المعتمدة في التقرير الختامي'
              : sec.id === 'students'
                ? `سجل الطلاب والطالبات المركزي (${students.length})`
                : sec.id === 'programs'
                  ? `البرامج والتقارير والمبادرات (${unifiedRecords.length})`
                  : sec.id === 'models_logs'
                    ? 'السجلات الخمسة الثابتة والنماذج الجاهزة الأربعة'
                    : sec.id === 'evidences'
                      ? `الأدلة المرئية وصفحات PDF والروابط (${allFinalReportVisualEvidences.length})`
                      : 'المؤشرات والإحصاءات المعتمدة للسجل',
        ]),
        [0.14, 0.32, 0.54]
      );

      // القسم ٣: بيانات الطلاب
      builder.drawSectionTitle(`٣. بيانات الطلاب (${students.length})`);
      if (students.length > 0) {
        const hasMobile = students.some((s) => hasNonEmptyText(s.studentMobile));
        const hasGuardian = students.some((s) => hasNonEmptyText(s.guardianName));
        const headers = [
          'م',
          'الاسم الرباعي',
          'رقم الهوية',
          'الجنس',
          'الصف',
          'العام والفصل',
        ];
        if (hasMobile) headers.push('جوال الطالب');
        if (hasGuardian) headers.push('ولي الأمر');

        builder.drawTable(
          headers,
          students.map((st, idx) => {
            const r = [
              String(idx + 1),
              st.name,
              st.civilId || '',
              st.gender || '',
              st.grade,
              `${st.academicYear || centralAcademicYear} - ${st.semester || centralSemester}`,
            ];
            if (hasMobile) r.push(st.studentMobile || '');
            if (hasGuardian) r.push(st.guardianName || '');
            return r;
          })
        );
      }

      // القسم ٤: البرامج والتقارير والمبادرات
      builder.drawSectionTitle(
        `٤. البرامج والتقارير والمبادرات (${unifiedRecords.length})`
      );
      if (unifiedRecords.length > 0) {
        builder.drawTable(
          ['النوع', 'العنوان', 'التاريخ / المدة', 'المشاركون', 'الشواهد'],
          unifiedRecords.map((rec) => [
            rec.recordType,
            rec.title,
            rec.hijriDate || rec.gregorianDate || rec.durationOption || '',
            String((rec.participants || []).length),
            String((rec.evidences || []).length),
          ]),
          [0.14, 0.36, 0.24, 0.13, 0.13]
        );
      }

      // القسم ٥: النماذج والسجلات
      builder.drawSectionTitle('٥. النماذج والسجلات (القسم الثالث)');
      builder.drawKeyValuePairs([
        {
          label: GIFTED_SECTION3_FIXED_LOG_LABELS.giftedStudentsLog,
          value: `${section3Data.giftedStudentsLog.length} سجل`,
        },
        {
          label: GIFTED_SECTION3_FIXED_LOG_LABELS.programParticipantsLog,
          value: `${section3Data.programParticipantsLog.length} سجل`,
        },
        {
          label: GIFTED_SECTION3_FIXED_LOG_LABELS.studentAchievementsLog,
          value: `${section3Data.studentAchievementsLog.length} سجل`,
        },
        {
          label: GIFTED_SECTION3_FIXED_LOG_LABELS.meetingsLog,
          value: `${section3Data.meetingsLog.length} اجتماع`,
        },
        {
          label: GIFTED_SECTION3_FIXED_LOG_LABELS.visitsAndPartnershipsLog,
          value: `${section3Data.visitsAndPartnershipsLog.length} زيارة/شراكة`,
        },
        {
          label: 'النماذج الجاهزة المحفوظة',
          value: `${section3Data.readyTemplates.length} نموذج`,
        },
      ]);

      // القسم ٦: الأدلة والمرفقات (صور + صفحات PDF المحولة بصرياً عبر pdfjs-dist + روابط QR)
      builder.drawSectionTitle('٦. الأدلة والمرفقات');
      await builder.drawVisualEvidencesSection(
        allFinalReportVisualEvidences,
        allFinalReportLinks
      );

      // القسم ٧: الإحصاءات ذات الصلة
      builder.drawSectionTitle('٧. الإحصاءات ذات الصلة');
      builder.drawKeyValuePairs([
        {
          label: 'إجمالي الطلاب بالسجل المركزي',
          value: `${studentStatisticalReportData.totalCentralStudents} (المستفيدون: ${studentStatisticalReportData.uniqueBeneficiaryStudentsCount})`,
        },
        {
          label: 'إجمالي المشاركات الفعلية (دون ازدواجية)',
          value: String(
            studentStatisticalReportData.deduplicatedParticipationsCount
          ),
        },
        {
          label: 'إجمالي الإنجازات المسجلة',
          value: String(
            studentStatisticalReportData.deduplicatedAchievementsCount
          ),
        },
        {
          label: 'نسبة إنجاز إجراءات البرامج الوزارية',
          value: `${studentStatisticalReportData.ministerialProgramsStats.ministerialActionsCompletionPct}% (${studentStatisticalReportData.ministerialProgramsStats.ministerialExecutedActionsCount}/${studentStatisticalReportData.ministerialProgramsStats.ministerialTotalActionsCount})`,
        },
      ]);

      builder.drawSignoff(
        basicInfo.coordinatorTitle,
        basicInfo.coordinatorName,
        basicInfo.principalTitle,
        basicInfo.principalName
      );
      const { renderedPages, previewDataUrls } = builder.finalize();
      return {
        renderedPages,
        previewDataUrls,
        filename: `التقرير_الختامي_للسجل_${safeSchool}_${safeYear}.pdf`,
        title: reportTitle,
      };
    }

    // ٥. التقرير الإحصائي للطلاب
    const reportTitle = 'التقرير الإحصائي للطلاب';
    const builder = createA4DocumentBuilder({
      reportTitle,
      reportSubtitle:
        'إحصاءات السجل المركزي للطلاب مع فصل البرامج الوزارية عن المسابقات والمبادرات',
      educationDepartment: basicInfo.educationDepartment,
      schoolName: basicInfo.schoolName,
      academicYear: selectedAcademicYear,
      semesterLabel: selectedSemester,
      moeLogoImg,
    });

    builder.drawSectionTitle('أولاً: إحصاءات السجل المركزي للطلاب');
    builder.drawKeyValuePairs([
      {
        label: 'إجمالي الطلاب في السجل المركزي',
        value: `${studentStatisticalReportData.totalCentralStudents}`,
      },
      {
        label: 'طلاب الفترة المختارة',
        value: `${studentStatisticalReportData.periodStudentsCount}`,
      },
      {
        label: 'الطلاب المستفيدون فعلياً (دون تكرار)',
        value: `${studentStatisticalReportData.uniqueBeneficiaryStudentsCount}`,
      },
      {
        label: 'إجمالي المشاركات والإنجازات (دون ازدواجية)',
        value: `المشاركات: ${studentStatisticalReportData.deduplicatedParticipationsCount} | الإنجازات: ${studentStatisticalReportData.deduplicatedAchievementsCount}`,
      },
    ]);

    if (studentStatisticalReportData.distributionByGrade.length > 0) {
      builder.drawSectionTitle('ثانياً: توزيع الطلاب حسب الصف الدراسي');
      builder.drawTable(
        ['الصف الدراسي', 'العدد', 'النسبة المئوية'],
        studentStatisticalReportData.distributionByGrade.map((g) => [
          g.grade,
          String(g.count),
          `${g.percentage}%`,
        ]),
        [0.5, 0.25, 0.25]
      );
    }

    builder.drawSectionTitle('ثالثاً: إحصاءات البرامج الوزارية (مستقلة)');
    builder.drawKeyValuePairs([
      {
        label: 'البرامج الوزارية المطبقة بالمدرسة',
        value: `${studentStatisticalReportData.ministerialProgramsStats.applicableMinisterialProgramsCount} برامج`,
      },
      {
        label: 'مؤشر إجراءات البرامج الوزارية',
        value: `${studentStatisticalReportData.ministerialProgramsStats.ministerialActionsCompletionPct}% (${studentStatisticalReportData.ministerialProgramsStats.ministerialExecutedActionsCount}/${studentStatisticalReportData.ministerialProgramsStats.ministerialTotalActionsCount})`,
      },
      {
        label: 'برامج بنطاق وزاري في القسم الثاني',
        value: `${studentStatisticalReportData.ministerialProgramsStats.unifiedMinisterialScopeProgramsCount}`,
      },
      {
        label: 'برامج بنطاق إدارة تعليم / مدرسة',
        value: `إدارة تعليم: ${studentStatisticalReportData.ministerialProgramsStats.unifiedEducationDeptProgramsCount} | مدرسة: ${studentStatisticalReportData.ministerialProgramsStats.unifiedSchoolScopeProgramsCount}`,
      },
    ]);

    builder.drawSectionTitle('رابعاً: إحصاءات المسابقات والمبادرات (مستقلة)');
    builder.drawKeyValuePairs([
      {
        label: 'المبادرات المسجلة في القسم الثاني',
        value: `${studentStatisticalReportData.initiativesAndCompetitionsStats.unifiedInitiativesCount}`,
      },
      {
        label: 'التقارير المسجلة في القسم الثاني',
        value: `${studentStatisticalReportData.initiativesAndCompetitionsStats.unifiedReportsCount}`,
      },
      {
        label: 'المسابقات العلمية المنفذة',
        value: `${studentStatisticalReportData.initiativesAndCompetitionsStats.scientificCompetitionsExecuted}/${studentStatisticalReportData.initiativesAndCompetitionsStats.scientificCompetitionsTotal}`,
      },
      {
        label: 'مؤشر إنجاز الخطة التنفيذية',
        value: `${studentStatisticalReportData.kpiSummary.executivePlanMetrics.completionPercentage}% (${studentStatisticalReportData.kpiSummary.executivePlanMetrics.executed}/${studentStatisticalReportData.kpiSummary.executivePlanMetrics.totalActive})`,
      },
    ]);

    builder.drawSignoff(
      basicInfo.coordinatorTitle,
      basicInfo.coordinatorName,
      basicInfo.principalTitle,
      basicInfo.principalName
    );
    const { renderedPages, previewDataUrls } = builder.finalize();
    return {
      renderedPages,
      previewDataUrls,
      filename: `التقرير_الاحصائي_للطلاب_${safeSchool}_${safeYear}.pdf`,
      title: reportTitle,
    };
  };

  const handlePreviewCurrentReportPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      const { previewDataUrls, title } = await buildCurrentReportPdfPages();
      setPdfPreviewPages(previewDataUrls);
      setPdfPreviewTitle(title);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleExportCurrentReportPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      const { renderedPages, previewDataUrls, filename, title } =
        await buildCurrentReportPdfPages();
      setPdfPreviewPages(previewDataUrls);
      setPdfPreviewTitle(title);
      const pdfBytes = buildMultiPageJpegPdfBytes(renderedPages);
      downloadGiftedPdfBytes(pdfBytes, filename);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // عنصر عرض الشواهد المرئية وصفحات PDF المحولة عبر pdfjs-dist والروابط التفاعلية
  const renderVisualEvidencesAndLinksGrid = (
    visualEvidences: ResolvedVisualEvidenceItem[],
    links: Array<{ id: string; title: string; url: string; sourceTitle?: string }>,
    testIdPrefix: string
  ) => {
    const validLinks = links.filter(
      (l) => hasNonEmptyText(l.title) && hasNonEmptyText(l.url)
    );

    if (visualEvidences.length === 0 && validLinks.length === 0) {
      return (
        <div
          data-testid={`${testIdPrefix}-empty-evidences`}
          className="rounded-xl border border-dashed border-stone-300 bg-[#FAF7F5] p-5 text-center text-xs text-stone-500 font-semibold"
        >
          لا توجد شواهد أو مرفقات أو روابط مسجلة لهذا النطاق.
        </div>
      );
    }

    return (
      <div className="space-y-5">
        {visualEvidences.length > 0 && (
          <div
            data-testid={`${testIdPrefix}-visual-evidences-grid`}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            {visualEvidences.map((ev) => {
              if (ev.kind === 'image' && ev.imageDataUrl) {
                return (
                  <article
                    key={`${ev.sourceRecordId}-${ev.evidenceId}`}
                    data-testid={`visual-evidence-image-card-${ev.evidenceId}`}
                    className="rounded-xl border border-[#E6C7D0] bg-white overflow-hidden shadow-xs flex flex-col"
                  >
                    <div className="bg-[#F9EFF2] px-4 py-2.5 border-b border-[#E6C7D0] flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <ImageIcon
                          className="w-4 h-4 text-[#7F1D3F] shrink-0"
                          aria-hidden="true"
                        />
                        <h5 className="text-xs sm:text-sm font-extrabold text-[#26323B] truncate">
                          {ev.title}
                        </h5>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-white text-[#7F1D3F] border border-[#E6C7D0] text-[11px] font-bold shrink-0">
                        صورة شاهد
                      </span>
                    </div>
                    <div className="p-3 bg-[#FAF7F5] flex items-center justify-center min-h-[200px]">
                      <img
                        src={ev.imageDataUrl}
                        alt={ev.title}
                        className="max-h-[260px] w-auto object-contain rounded-lg border border-stone-200 bg-white"
                      />
                    </div>
                    {hasNonEmptyText(ev.caption) && (
                      <p className="px-4 py-2 text-xs text-stone-600 border-t border-stone-100">
                        {ev.caption}
                      </p>
                    )}
                  </article>
                );
              }

              // عرض صفحات PDF المحولة بصرياً عبر pdfjs-dist صفحة بصفحة
              const pdfPages = ev.pdfPages || [];
              if (pdfPages.length > 0) {
                return pdfPages.map((pdfPage) => (
                  <article
                    key={`${ev.sourceRecordId}-${ev.evidenceId}-page-${pdfPage.pageNumber}`}
                    data-testid={`visual-evidence-pdf-page-${ev.evidenceId}-${pdfPage.pageNumber}`}
                    className="rounded-xl border border-[#E6C7D0] bg-white overflow-hidden shadow-xs flex flex-col"
                  >
                    <div className="bg-[#F9EFF2] px-4 py-2.5 border-b border-[#E6C7D0] flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <h5
                          data-testid={`pdf-page-evidence-title-${ev.evidenceId}-${pdfPage.pageNumber}`}
                          className="text-xs sm:text-sm font-extrabold text-[#26323B] truncate"
                        >
                          {pdfPage.evidenceTitle}
                        </h5>
                        <p className="text-[11px] text-stone-600 truncate">
                          {ev.sourceRecordTitle}
                        </p>
                      </div>
                      <span
                        data-testid={`pdf-page-number-badge-${ev.evidenceId}-${pdfPage.pageNumber}`}
                        className="px-2.5 py-1 rounded-md bg-[#7F1D3F] text-white text-[11px] font-extrabold shrink-0 tabular-nums"
                      >
                        صفحة {pdfPage.pageNumber} من {pdfPage.totalPages}
                      </span>
                    </div>
                    <div className="p-3 bg-[#FAF7F5] flex items-center justify-center min-h-[220px]">
                      <img
                        src={pdfPage.dataUrl}
                        alt={`${pdfPage.evidenceTitle} - صفحة ${pdfPage.pageNumber}`}
                        data-testid={`pdf-page-rendered-img-${ev.evidenceId}-${pdfPage.pageNumber}`}
                        className="max-h-[300px] w-auto object-contain rounded-lg border border-stone-200 bg-white shadow-2xs"
                      />
                    </div>
                    {hasNonEmptyText(pdfPage.evidenceCaption) && (
                      <p className="px-4 py-2 text-xs text-stone-600 border-t border-stone-100">
                        {pdfPage.evidenceCaption}
                      </p>
                    )}
                  </article>
                ));
              }

              return (
                <article
                  key={`${ev.sourceRecordId}-${ev.evidenceId}-loading`}
                  className="rounded-xl border border-stone-200 bg-[#FAF7F5] p-4 flex items-center justify-between gap-3"
                >
                  <div>
                    <h5 className="text-xs font-extrabold text-[#26323B]">
                      {ev.title}
                    </h5>
                    <p className="text-[11px] text-stone-500">
                      {isLoadingEvidences
                        ? 'جاري معالجة صفحات PDF بصرياً...'
                        : ev.filename}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {validLinks.length > 0 && (
          <div
            data-testid={`${testIdPrefix}-qr-links-grid`}
            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            {validLinks.map((lnk) => {
              const qrSvgUrl = generateQrSvgDataUrl(
                lnk.url,
                '#26323B',
                '#FFFFFF',
                3
              );
              return (
                <a
                  key={`${lnk.id}-${lnk.url}`}
                  href={lnk.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid={`report-qr-link-card-${lnk.id}`}
                  className="rounded-xl border border-[#E6C7D0] bg-[#FAF7F5] hover:bg-[#F9EFF2]/60 p-3.5 flex items-center gap-3.5 transition-colors group"
                >
                  <img
                    src={qrSvgUrl}
                    alt={`QR ${lnk.title}`}
                    className="w-20 h-20 rounded-lg border border-stone-200 bg-white p-1 shrink-0"
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs sm:text-sm font-extrabold text-[#7F1D3F] group-hover:underline">
                      <QrCode className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{lnk.title}</span>
                      <ExternalLink
                        className="w-3 h-3 shrink-0"
                        aria-hidden="true"
                      />
                    </div>
                    {hasNonEmptyText(lnk.sourceTitle) && (
                      <p className="text-[11px] font-semibold text-[#26323B] truncate">
                        {lnk.sourceTitle}
                      </p>
                    )}
                    <p className="text-[11px] text-stone-500 truncate dir-ltr text-right">
                      {lnk.url}
                    </p>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // الترويسة والكليشة الرسمية الموحدة لمكتبي في جميع التقارير الخمسة
  const renderOfficialMaktabiReportHeader = (
    yearOverride?: string,
    semesterOverride?: string
  ) => {
    const headerYear = yearOverride || selectedAcademicYear;
    const headerSemester = semesterOverride || selectedSemester;
    return (
      <header
        data-testid="gifted-report-official-header"
        className="border-b-2 border-[#E6C7D0] pb-4 mb-2"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-4 px-2 sm:px-4">
          {/* الجهة اليمنى: المملكة / وزارة التعليم / الإدارة التعليمية / المدرسة */}
          <div className="flex justify-center sm:justify-start">
            <div
              data-testid="gifted-report-header-right"
              className="text-center sm:text-right space-y-0.5 text-xs sm:text-sm leading-relaxed"
            >
              <p className="font-extrabold text-stone-950">
                المملكة العربية السعودية
              </p>
              <p className="font-bold text-stone-800">وزارة التعليم</p>
              <p className="font-semibold text-stone-900">
                {basicInfo.educationDepartment || 'غير محدد'}
              </p>
              <p className="font-semibold text-stone-900">
                {basicInfo.schoolName || 'غير محدد'}
              </p>
            </div>
          </div>

          {/* المنتصف: شعار وزارة التعليم الرسمي */}
          <div className="flex items-center justify-center">
            <div
              data-testid="gifted-report-header-logo-container"
              className="w-28 sm:w-36 aspect-[48/38] overflow-hidden flex items-center justify-center mx-auto shrink-0"
            >
              <img
                src="./moe-logo.png"
                alt="شعار وزارة التعليم"
                referrerPolicy="no-referrer"
                data-testid="gifted-report-header-logo"
                className="w-[208%] max-w-none h-auto object-contain select-none pointer-events-none"
              />
            </div>
          </div>

          {/* الجهة اليسرى: الموهوبين + الصفة + العام الدراسي والفصل */}
          <div className="flex justify-center sm:justify-end">
            <div
              data-testid="gifted-report-header-left"
              className="text-center sm:text-left space-y-1 text-xs sm:text-sm leading-relaxed"
            >
              <p className="font-extrabold text-sm sm:text-base text-[#7F1D3F]">
                الموهوبين
              </p>
              <p className="font-bold text-xs text-[#26323B]">
                سجل {terms.coordinatorSingular}
              </p>
              <p className="font-semibold text-stone-800 tabular-nums text-xs">
                {headerYear} — {headerSemester}
              </p>
            </div>
          </div>
        </div>
      </header>
    );
  };

  return (
    <div
      dir="rtl"
      data-testid="gifted-reports-engine"
      className="space-y-6 text-[#26323B]"
    >
      {/* ١. شريط اختيار الفترة (العام الدراسي والفصل الدراسي) للتقارير والتقارير التاريخية دون المساس بالإعدادات المركزية */}
      <section
        data-testid="reports-period-selector-bar"
        className="rounded-2xl border border-[#E6C7D0] bg-white p-4 sm:p-5 shadow-xs space-y-4"
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-[#F9EFF2] text-[#7F1D3F] border border-[#E6C7D0] text-xs font-extrabold">
                04 التقارير
              </span>
              <h3 className="text-base sm:text-lg font-extrabold text-[#26323B]">
                مركز التقارير الرسمية لسجل {terms.coordinatorSingular}
              </h3>
            </div>
            <p className="text-xs text-stone-600">
              يمكنك اختيار العام الدراسي والفصل الدراسي لإعداد تقارير الفترة الحالية أو التقارير التاريخية دون تغيير إعدادات مكتبي المركزية ({centralAcademicYear} — {centralSemester}).
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1 min-w-[150px] flex-1 sm:flex-initial">
              <label
                htmlFor="report-academic-year-select"
                className="block text-xs font-bold text-[#26323B]"
              >
                العام الدراسي للتقرير
              </label>
              <select
                id="report-academic-year-select"
                data-testid="report-academic-year-select"
                value={selectedAcademicYear}
                onChange={(e) => {
                  setSelectedAcademicYear(e.target.value);
                  setPdfPreviewPages([]);
                }}
                className="w-full min-h-[40px] rounded-xl border border-stone-300 bg-[#FAF7F5] px-3 py-1.5 text-xs sm:text-sm font-bold text-[#26323B] focus:border-[#7F1D3F] focus:outline-none"
              >
                {availableAcademicYears.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1 min-w-[180px] flex-1 sm:flex-initial">
              <label
                htmlFor="report-semester-select"
                className="block text-xs font-bold text-[#26323B]"
              >
                الفصل الدراسي للتقرير
              </label>
              <select
                id="report-semester-select"
                data-testid="report-semester-select"
                value={selectedSemester}
                onChange={(e) => {
                  setSelectedSemester(
                    normalizeApprovedSemester(e.target.value)
                  );
                  setPdfPreviewPages([]);
                }}
                className="w-full min-h-[40px] rounded-xl border border-stone-300 bg-[#FAF7F5] px-3 py-1.5 text-xs sm:text-sm font-bold text-[#26323B] focus:border-[#7F1D3F] focus:outline-none"
              >
                {APPROVED_SCHOOL_SEMESTERS.map((sem) => (
                  <option key={sem} value={sem}>
                    {sem}
                  </option>
                ))}
              </select>
            </div>

            {(selectedAcademicYear !== centralAcademicYear ||
              selectedSemester !== centralSemester) && (
              <button
                type="button"
                data-testid="reset-report-period-to-central-btn"
                onClick={() => {
                  setSelectedAcademicYear(centralAcademicYear);
                  setSelectedSemester(centralSemester);
                  setPdfPreviewPages([]);
                }}
                className="min-h-[40px] px-3 py-1.5 rounded-xl border border-[#E6C7D0] bg-[#F9EFF2] text-[#7F1D3F] text-xs font-extrabold hover:bg-[#f2dfe5] transition-colors cursor-pointer"
              >
                العودة للفترة المركزية الحالية
              </button>
            )}
          </div>
        </div>

        {/* شريط التبويبات الخمسة المعتمدة حصرياً */}
        <nav
          aria-label="أنواع التقارير الخمسة المعتمدة"
          data-testid="approved-five-reports-nav"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 pt-2 border-t border-stone-200/80"
        >
          {APPROVED_REPORT_TABS.map((tab) => {
            const isActive = activeReportKind === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                data-testid={`report-tab-btn-${tab.id}`}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => {
                  setActiveReportKind(tab.id);
                  setPdfPreviewPages([]);
                }}
                className={`min-h-[54px] p-3 rounded-xl border text-right transition-all flex items-start gap-2.5 cursor-pointer ${
                  isActive
                    ? 'bg-[#7F1D3F] text-white border-[#7F1D3F] shadow-xs'
                    : 'bg-[#FAF7F5] text-[#26323B] border-stone-200 hover:border-[#E6C7D0] hover:bg-white'
                }`}
              >
                <span
                  className={`w-7 h-7 rounded-lg text-xs font-extrabold flex items-center justify-center shrink-0 tabular-nums ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-[#F9EFF2] text-[#7F1D3F]'
                  }`}
                >
                  {tab.orderNumber}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-xs sm:text-sm font-extrabold leading-snug">
                    {tab.icon}
                    <span className="truncate">{tab.title}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </nav>

        {/* أزرار معاينة وتصدير PDF للتقرير المختار */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-stone-200/80">
          <div className="text-xs font-semibold text-stone-600 flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#7F1D3F]" aria-hidden="true" />
            <span>
              التقرير النشط:{' '}
              <strong className="text-[#26323B]">
                {
                  APPROVED_REPORT_TABS.find((t) => t.id === activeReportKind)
                    ?.title
                }
              </strong>{' '}
              ({selectedAcademicYear} — {selectedSemester})
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="preview-active-report-pdf-btn"
              disabled={isGeneratingPdf}
              onClick={handlePreviewCurrentReportPdf}
              className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-[#7F1D3F] bg-white hover:bg-[#F9EFF2] text-[#7F1D3F] text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
            >
              {isGeneratingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Eye className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>معاينة صفحات PDF (A4)</span>
            </button>

            <button
              type="button"
              data-testid="export-active-report-pdf-btn"
              disabled={isGeneratingPdf}
              onClick={handleExportCurrentReportPdf}
              className="min-h-[38px] px-4 py-1.5 rounded-xl bg-[#7F1D3F] hover:bg-[#641631] text-white text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
            >
              {isGeneratingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>تصدير وتحميل PDF</span>
            </button>
          </div>
        </div>
      </section>

      {/* عارض معاينة صفحات A4 PDF عند تفعيله */}
      {pdfPreviewPages.length > 0 && (
        <section
          data-testid="report-a4-pdf-preview-section"
          className="rounded-2xl border-2 border-[#7F1D3F] bg-[#26323B] p-4 sm:p-5 text-white space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-sm sm:text-base font-extrabold text-white">
                معاينة صفحات A4 الرسمية: {pdfPreviewTitle}
              </h4>
              <p className="text-xs text-stone-300">
                إجمالي الصفحات المولدة: {pdfPreviewPages.length} صفحة (تتضمن الشواهد المصورة وصفحات PDF المحولة ورموز QR)
              </p>
            </div>
            <button
              type="button"
              data-testid="close-pdf-preview-btn"
              onClick={() => setPdfPreviewPages([])}
              className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-bold cursor-pointer"
            >
              إغلاق المعاينة
            </button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {pdfPreviewPages.map((pageUrl, idx) => (
              <div
                key={`pdf-page-${idx + 1}`}
                data-testid={`pdf-preview-page-card-${idx + 1}`}
                className="rounded-xl bg-white p-2.5 text-[#26323B] space-y-2"
              >
                <div className="flex items-center justify-between text-xs font-extrabold px-1">
                  <span>صفحة {idx + 1} من {pdfPreviewPages.length}</span>
                  <span className="text-[#7F1D3F]">A4 PDF</span>
                </div>
                <img
                  src={pageUrl}
                  alt={`معاينة صفحة ${idx + 1}`}
                  className="w-full h-auto rounded border border-stone-200"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* =====================================================================
          التقرير الأول: ١. تقرير برنامج أو مبادرة
         ===================================================================== */}
      {activeReportKind === 'program_or_initiative_report' && (
        <section
          data-testid="report-view-program_or_initiative_report"
          className="rounded-2xl border border-[#E6C7D0] bg-white p-4 sm:p-6 shadow-xs space-y-6"
        >
          {renderOfficialMaktabiReportHeader(
            selectedProgramRecord?.academicYear || selectedAcademicYear,
            selectedProgramRecord?.semester || selectedSemester
          )}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-stone-200">
            <div className="space-y-1">
              <h4 className="text-base sm:text-lg font-extrabold text-[#7F1D3F]">
                ١. تقرير برنامج أو مبادرة
              </h4>
              <p className="text-xs text-stone-600">
                اختر سجل البرنامج أو المبادرة من البيانات المحفوظة في القسم الثاني لعرض بياناته ومشاركاته ونتائجه وشواهده وروابطه.
              </p>
            </div>

            <div className="w-full sm:w-80 space-y-1">
              <label
                htmlFor="select-program-record"
                className="block text-xs font-bold text-[#26323B]"
              >
                اختيار البرنامج أو المبادرة المحفوظة (
                {programOrInitiativeRecords.length})
              </label>
              <select
                id="select-program-record"
                data-testid="select-program-record"
                value={selectedProgramRecord?.id || ''}
                onChange={(e) => {
                  setSelectedProgramRecordId(e.target.value);
                  setPdfPreviewPages([]);
                }}
                className="w-full min-h-[42px] rounded-xl border border-stone-300 bg-[#FAF7F5] px-3 py-2 text-xs sm:text-sm font-bold text-[#26323B] focus:border-[#7F1D3F] focus:outline-none"
              >
                {programOrInitiativeRecords.length === 0 ? (
                  <option value="">لا توجد سجلات محفوظة</option>
                ) : (
                  programOrInitiativeRecords.map((r) => (
                    <option key={r.id} value={r.id}>
                      [{r.recordType}] {r.title} ({r.academicYear} —{' '}
                      {r.semester})
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {!selectedProgramRecord ? (
            <div
              data-testid="empty-program-report-state"
              className="rounded-xl border border-dashed border-stone-300 bg-[#FAF7F5] p-8 text-center space-y-2"
            >
              <p className="text-sm font-extrabold text-[#26323B]">
                لا توجد برامج أو تقارير أو مبادرات محفوظة في السجل حالياً
              </p>
              <p className="text-xs text-stone-500">
                أضف سجل برنامج أو تقرير أو مبادرة في قسم «02 البرامج والتقارير والمبادرات» ليظهر هنا تلقائياً.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* بطاقة البيانات الأساسية للسجل المختار — مع إخفاء الحقول الاختيارية الفارغة */}
              <div className="rounded-xl border border-[#E6C7D0] bg-[#FAF7F5] p-4 sm:p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      data-testid="program-report-type-badge"
                      className="px-3 py-1 rounded-lg bg-[#7F1D3F] text-white text-xs font-extrabold"
                    >
                      {selectedProgramRecord.recordType}
                    </span>
                    <h5
                      data-testid="program-report-title"
                      className="text-base sm:text-lg font-extrabold text-[#26323B]"
                    >
                      {selectedProgramRecord.title}
                    </h5>
                  </div>
                  <span className="text-xs font-bold text-[#7F1D3F] bg-white px-3 py-1 rounded-lg border border-[#E6C7D0]">
                    {selectedProgramRecord.academicYear} —{' '}
                    {selectedProgramRecord.semester}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(hasNonEmptyText(selectedProgramRecord.hijriDate) ||
                    hasNonEmptyText(selectedProgramRecord.gregorianDate)) && (
                    <div className="rounded-lg bg-white p-3 border border-stone-200">
                      <span className="block text-[11px] font-bold text-stone-500">
                        تاريخ التنفيذ
                      </span>
                      <span className="text-xs sm:text-sm font-extrabold text-[#26323B]">
                        {[
                          selectedProgramRecord.hijriDate,
                          selectedProgramRecord.gregorianDate
                            ? `(${selectedProgramRecord.gregorianDate})`
                            : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      </span>
                    </div>
                  )}

                  {!hasNonEmptyText(selectedProgramRecord.hijriDate) &&
                    !hasNonEmptyText(selectedProgramRecord.gregorianDate) &&
                    hasNonEmptyText(selectedProgramRecord.durationOption) && (
                      <div className="rounded-lg bg-white p-3 border border-stone-200">
                        <span className="block text-[11px] font-bold text-stone-500">
                          المدة المعتمدة
                        </span>
                        <span className="text-xs sm:text-sm font-extrabold text-[#26323B]">
                          {selectedProgramRecord.durationOption}
                        </span>
                      </div>
                    )}

                  {hasNonEmptyText(selectedProgramRecord.location) && (
                    <div
                      data-testid="program-report-location-field"
                      className="rounded-lg bg-white p-3 border border-stone-200"
                    >
                      <span className="block text-[11px] font-bold text-stone-500">
                        الموقع
                      </span>
                      <span className="text-xs sm:text-sm font-extrabold text-[#26323B]">
                        {selectedProgramRecord.location}
                      </span>
                    </div>
                  )}

                  {selectedProgramRecord.recordType === 'برنامج' &&
                    selectedProgramRecord.programFields && (
                      <>
                        <div className="rounded-lg bg-white p-3 border border-stone-200">
                          <span className="block text-[11px] font-bold text-stone-500">
                            نطاق التنفيذ
                          </span>
                          <span className="text-xs sm:text-sm font-extrabold text-[#7F1D3F]">
                            {
                              selectedProgramRecord.programFields
                                .executionScope
                            }
                          </span>
                        </div>
                        {hasNonEmptyText(
                          selectedProgramRecord.programFields
                            .programTypeOrField
                        ) && (
                          <div className="rounded-lg bg-white p-3 border border-stone-200">
                            <span className="block text-[11px] font-bold text-stone-500">
                              نوع البرنامج أو مجاله
                            </span>
                            <span className="text-xs sm:text-sm font-extrabold text-[#26323B]">
                              {
                                selectedProgramRecord.programFields
                                  .programTypeOrField
                              }
                            </span>
                          </div>
                        )}
                        {hasNonEmptyText(
                          selectedProgramRecord.programFields.targetAudience
                        ) && (
                          <div className="rounded-lg bg-white p-3 border border-stone-200">
                            <span className="block text-[11px] font-bold text-stone-500">
                              الفئة المستهدفة
                            </span>
                            <span className="text-xs sm:text-sm font-extrabold text-[#26323B]">
                              {
                                selectedProgramRecord.programFields
                                  .targetAudience
                              }
                            </span>
                          </div>
                        )}
                        {hasNonEmptyText(
                          selectedProgramRecord.programFields.executingEntity
                        ) && (
                          <div className="rounded-lg bg-white p-3 border border-stone-200">
                            <span className="block text-[11px] font-bold text-stone-500">
                              الجهة المنفذة
                            </span>
                            <span className="text-xs sm:text-sm font-extrabold text-[#26323B]">
                              {
                                selectedProgramRecord.programFields
                                  .executingEntity
                              }
                            </span>
                          </div>
                        )}
                      </>
                    )}

                  {selectedProgramRecord.recordType === 'مبادرة' &&
                    selectedProgramRecord.initiativeFields &&
                    hasNonEmptyText(
                      selectedProgramRecord.initiativeFields.targetAudience
                    ) && (
                      <div className="rounded-lg bg-white p-3 border border-stone-200">
                        <span className="block text-[11px] font-bold text-stone-500">
                          الفئة المستهدفة
                        </span>
                        <span className="text-xs sm:text-sm font-extrabold text-[#26323B]">
                          {
                            selectedProgramRecord.initiativeFields
                              .targetAudience
                          }
                        </span>
                      </div>
                    )}
                </div>

                {hasNonEmptyText(selectedProgramRecord.description) && (
                  <div className="rounded-lg bg-white p-3.5 border border-stone-200 space-y-1">
                    <span className="block text-xs font-extrabold text-[#7F1D3F]">
                      الوصف
                    </span>
                    <p className="text-xs sm:text-sm text-[#26323B] leading-relaxed whitespace-pre-line">
                      {selectedProgramRecord.description}
                    </p>
                  </div>
                )}

                {/* تفاصيل الحقول غير الفارغة بحسب نوع السجل */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selectedProgramRecord.recordType === 'برنامج' &&
                    selectedProgramRecord.programFields && (
                      <>
                        {hasNonEmptyText(
                          selectedProgramRecord.programFields.objective
                        ) && (
                          <div className="rounded-lg bg-white p-3.5 border border-stone-200 space-y-1">
                            <span className="block text-xs font-extrabold text-[#7F1D3F]">
                              الهدف
                            </span>
                            <p className="text-xs sm:text-sm text-[#26323B] whitespace-pre-line">
                              {selectedProgramRecord.programFields.objective}
                            </p>
                          </div>
                        )}
                        {hasNonEmptyText(
                          selectedProgramRecord.programFields.results
                        ) && (
                          <div className="rounded-lg bg-white p-3.5 border border-stone-200 space-y-1">
                            <span className="block text-xs font-extrabold text-[#7F1D3F]">
                              النتائج
                            </span>
                            <p className="text-xs sm:text-sm text-[#26323B] whitespace-pre-line">
                              {selectedProgramRecord.programFields.results}
                            </p>
                          </div>
                        )}
                        {hasNonEmptyText(
                          selectedProgramRecord.programFields
                            .notesAndRecommendations
                        ) && (
                          <div className="rounded-lg bg-white p-3.5 border border-stone-200 space-y-1 md:col-span-2">
                            <span className="block text-xs font-extrabold text-[#7F1D3F]">
                              الملاحظات والتوصيات
                            </span>
                            <p className="text-xs sm:text-sm text-[#26323B] whitespace-pre-line">
                              {
                                selectedProgramRecord.programFields
                                  .notesAndRecommendations
                              }
                            </p>
                          </div>
                        )}
                      </>
                    )}

                  {selectedProgramRecord.recordType === 'تقرير' &&
                    selectedProgramRecord.reportFields && (
                      <>
                        {hasNonEmptyText(
                          selectedProgramRecord.reportFields.reportObjectives
                        ) && (
                          <div className="rounded-lg bg-white p-3.5 border border-stone-200 space-y-1">
                            <span className="block text-xs font-extrabold text-[#7F1D3F]">
                              أهداف التقرير
                            </span>
                            <p className="text-xs sm:text-sm text-[#26323B] whitespace-pre-line">
                              {
                                selectedProgramRecord.reportFields
                                  .reportObjectives
                              }
                            </p>
                          </div>
                        )}
                        {hasNonEmptyText(
                          selectedProgramRecord.reportFields.resultsAndOutputs
                        ) && (
                          <div className="rounded-lg bg-white p-3.5 border border-stone-200 space-y-1">
                            <span className="block text-xs font-extrabold text-[#7F1D3F]">
                              النتائج والمخرجات
                            </span>
                            <p className="text-xs sm:text-sm text-[#26323B] whitespace-pre-line">
                              {
                                selectedProgramRecord.reportFields
                                  .resultsAndOutputs
                              }
                            </p>
                          </div>
                        )}
                        {hasNonEmptyText(
                          selectedProgramRecord.reportFields
                            .achievementIndicators
                        ) && (
                          <div className="rounded-lg bg-white p-3.5 border border-stone-200 space-y-1">
                            <span className="block text-xs font-extrabold text-[#7F1D3F]">
                              مؤشرات التحقق
                            </span>
                            <p className="text-xs sm:text-sm text-[#26323B] whitespace-pre-line">
                              {
                                selectedProgramRecord.reportFields
                                  .achievementIndicators
                              }
                            </p>
                          </div>
                        )}
                        {hasNonEmptyText(
                          selectedProgramRecord.reportFields
                            .challengesAndDifficulties
                        ) && (
                          <div className="rounded-lg bg-white p-3.5 border border-stone-200 space-y-1">
                            <span className="block text-xs font-extrabold text-[#7F1D3F]">
                              التحديات والصعوبات
                            </span>
                            <p className="text-xs sm:text-sm text-[#26323B] whitespace-pre-line">
                              {
                                selectedProgramRecord.reportFields
                                  .challengesAndDifficulties
                              }
                            </p>
                          </div>
                        )}
                        {hasNonEmptyText(
                          selectedProgramRecord.reportFields
                            .recommendationsAndProposals
                        ) && (
                          <div className="rounded-lg bg-white p-3.5 border border-stone-200 space-y-1">
                            <span className="block text-xs font-extrabold text-[#7F1D3F]">
                              التوصيات والمقترحات
                            </span>
                            <p className="text-xs sm:text-sm text-[#26323B] whitespace-pre-line">
                              {
                                selectedProgramRecord.reportFields
                                  .recommendationsAndProposals
                              }
                            </p>
                          </div>
                        )}
                        {hasNonEmptyText(
                          selectedProgramRecord.reportFields.notes
                        ) && (
                          <div className="rounded-lg bg-white p-3.5 border border-stone-200 space-y-1">
                            <span className="block text-xs font-extrabold text-[#7F1D3F]">
                              ملاحظات
                            </span>
                            <p className="text-xs sm:text-sm text-[#26323B] whitespace-pre-line">
                              {selectedProgramRecord.reportFields.notes}
                            </p>
                          </div>
                        )}
                      </>
                    )}

                  {selectedProgramRecord.recordType === 'مبادرة' &&
                    selectedProgramRecord.initiativeFields && (
                      <>
                        {hasNonEmptyText(
                          selectedProgramRecord.initiativeFields.initiativeIdea
                        ) && (
                          <div className="rounded-lg bg-white p-3.5 border border-stone-200 space-y-1">
                            <span className="block text-xs font-extrabold text-[#7F1D3F]">
                              فكرة المبادرة
                            </span>
                            <p className="text-xs sm:text-sm text-[#26323B] whitespace-pre-line">
                              {
                                selectedProgramRecord.initiativeFields
                                  .initiativeIdea
                              }
                            </p>
                          </div>
                        )}
                        {hasNonEmptyText(
                          selectedProgramRecord.initiativeFields
                            .initiativeObjectives
                        ) && (
                          <div className="rounded-lg bg-white p-3.5 border border-stone-200 space-y-1">
                            <span className="block text-xs font-extrabold text-[#7F1D3F]">
                              أهداف المبادرة
                            </span>
                            <p className="text-xs sm:text-sm text-[#26323B] whitespace-pre-line">
                              {
                                selectedProgramRecord.initiativeFields
                                  .initiativeObjectives
                              }
                            </p>
                          </div>
                        )}
                        {hasNonEmptyText(
                          selectedProgramRecord.initiativeFields.executionSteps
                        ) && (
                          <div className="rounded-lg bg-white p-3.5 border border-stone-200 space-y-1">
                            <span className="block text-xs font-extrabold text-[#7F1D3F]">
                              خطوات التنفيذ
                            </span>
                            <p className="text-xs sm:text-sm text-[#26323B] whitespace-pre-line">
                              {
                                selectedProgramRecord.initiativeFields
                                  .executionSteps
                              }
                            </p>
                          </div>
                        )}
                        {hasNonEmptyText(
                          selectedProgramRecord.initiativeFields.resultsAndImpact
                        ) && (
                          <div className="rounded-lg bg-white p-3.5 border border-stone-200 space-y-1">
                            <span className="block text-xs font-extrabold text-[#7F1D3F]">
                              النتائج والأثر
                            </span>
                            <p className="text-xs sm:text-sm text-[#26323B] whitespace-pre-line">
                              {
                                selectedProgramRecord.initiativeFields
                                  .resultsAndImpact
                              }
                            </p>
                          </div>
                        )}
                        {hasNonEmptyText(
                          selectedProgramRecord.initiativeFields.challenges
                        ) && (
                          <div className="rounded-lg bg-white p-3.5 border border-stone-200 space-y-1">
                            <span className="block text-xs font-extrabold text-[#7F1D3F]">
                              التحديات
                            </span>
                            <p className="text-xs sm:text-sm text-[#26323B] whitespace-pre-line">
                              {selectedProgramRecord.initiativeFields.challenges}
                            </p>
                          </div>
                        )}
                        {hasNonEmptyText(
                          selectedProgramRecord.initiativeFields.recommendations
                        ) && (
                          <div className="rounded-lg bg-white p-3.5 border border-stone-200 space-y-1">
                            <span className="block text-xs font-extrabold text-[#7F1D3F]">
                              التوصيات
                            </span>
                            <p className="text-xs sm:text-sm text-[#26323B] whitespace-pre-line">
                              {
                                selectedProgramRecord.initiativeFields
                                  .recommendations
                              }
                            </p>
                          </div>
                        )}
                      </>
                    )}
                </div>
              </div>

              {/* جدول المشاركين في البرنامج — لا يعرض الأعمدة الاختيارية الفارغة */}
              {selectedProgramRecord.participants &&
                selectedProgramRecord.participants.length > 0 && (
                  <div className="space-y-3">
                    <h5 className="text-sm font-extrabold text-[#26323B] flex items-center gap-2">
                      <Users
                        className="w-4 h-4 text-[#7F1D3F]"
                        aria-hidden="true"
                      />
                      <span>
                        المشاركون في السجل (
                        {selectedProgramRecord.participants.length})
                      </span>
                    </h5>
                    <div className="overflow-x-auto rounded-xl border border-stone-200">
                      <table
                        data-testid="program-report-participants-table"
                        className="w-full text-right text-xs sm:text-sm"
                      >
                        <thead className="bg-[#26323B] text-white">
                          <tr>
                            <th className="px-3 py-2.5 font-bold">#</th>
                            <th className="px-3 py-2.5 font-bold">
                              الاسم الرباعي
                            </th>
                            <th className="px-3 py-2.5 font-bold">
                              الصف وقت المشاركة
                            </th>
                            {selectedProgramRecord.participants.some((p) =>
                              hasNonEmptyText(p.statusRole)
                            ) && (
                              <th className="px-3 py-2.5 font-bold">
                                الصفة أو الحالة
                              </th>
                            )}
                            {selectedProgramRecord.participants.some((p) =>
                              hasNonEmptyText(p.participationType)
                            ) && (
                              <th className="px-3 py-2.5 font-bold">
                                نوع المشاركة
                              </th>
                            )}
                            {selectedProgramRecord.participants.some((p) =>
                              hasNonEmptyText(p.scoreOrEvaluation)
                            ) && (
                              <th className="px-3 py-2.5 font-bold">
                                الدرجة أو التقييم
                              </th>
                            )}
                            {selectedProgramRecord.participants.some((p) =>
                              hasNonEmptyText(p.achievement)
                            ) && (
                              <th className="px-3 py-2.5 font-bold">الإنجاز</th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-200 bg-white">
                          {selectedProgramRecord.participants.map((p, idx) => {
                            const st = studentsById.get(p.studentId);
                            const historicalGrade = hasNonEmptyText(
                              p.studentGradeAtParticipation
                            )
                              ? p.studentGradeAtParticipation
                              : st?.grade || '';
                            return (
                              <tr
                                key={`${p.studentId}-${idx}`}
                                className="hover:bg-[#FAF7F5]"
                              >
                                <td className="px-3 py-2.5 font-bold tabular-nums">
                                  {idx + 1}
                                </td>
                                <td className="px-3 py-2.5 font-extrabold text-[#26323B]">
                                  {st?.name || 'طالب مسجل'}
                                </td>
                                <td
                                  data-testid={`program-participant-historical-grade-${p.studentId}`}
                                  className="px-3 py-2.5 font-semibold text-[#7F1D3F]"
                                >
                                  {historicalGrade}
                                </td>
                                {selectedProgramRecord.participants.some((x) =>
                                  hasNonEmptyText(x.statusRole)
                                ) && (
                                  <td className="px-3 py-2.5">
                                    {p.statusRole || ''}
                                  </td>
                                )}
                                {selectedProgramRecord.participants.some((x) =>
                                  hasNonEmptyText(x.participationType)
                                ) && (
                                  <td className="px-3 py-2.5">
                                    {p.participationType || ''}
                                  </td>
                                )}
                                {selectedProgramRecord.participants.some((x) =>
                                  hasNonEmptyText(x.scoreOrEvaluation)
                                ) && (
                                  <td className="px-3 py-2.5">
                                    {p.scoreOrEvaluation || ''}
                                  </td>
                                )}
                                {selectedProgramRecord.participants.some((x) =>
                                  hasNonEmptyText(x.achievement)
                                ) && (
                                  <td className="px-3 py-2.5">
                                    {p.achievement || ''}
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              {/* الشواهد المرئية (صور + صفحات PDF) والروابط التفاعلية */}
              <div className="space-y-3">
                <h5 className="text-sm font-extrabold text-[#26323B] flex items-center gap-2">
                  <FolderOpen
                    className="w-4 h-4 text-[#7F1D3F]"
                    aria-hidden="true"
                  />
                  <span>الشواهد والمرفقات والروابط</span>
                </h5>
                {renderVisualEvidencesAndLinksGrid(
                  selectedProgramVisualEvidences,
                  (selectedProgramRecord.links || []).map((l) => ({
                    id: l.id,
                    title: l.title,
                    url: l.url,
                    sourceTitle: selectedProgramRecord.title,
                  })),
                  'program-report'
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* =====================================================================
          التقرير الثاني: ٢. تقرير طالب
         ===================================================================== */}
      {activeReportKind === 'student_report' && (
        <section
          data-testid="report-view-student_report"
          className="rounded-2xl border border-[#E6C7D0] bg-white p-4 sm:p-6 shadow-xs space-y-6"
        >
          {renderOfficialMaktabiReportHeader()}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-stone-200">
            <div className="space-y-1">
              <h4 className="text-base sm:text-lg font-extrabold text-[#7F1D3F]">
                ٢. تقرير طالب
              </h4>
              <p className="text-xs text-stone-600">
                اختر الطالب من السجل المركزي لعرض بياناته ومشاركاته وإنجازاته وسجله التاريخي مع الحفاظ على الصف وقت المشاركة.
              </p>
            </div>

            <div className="w-full sm:w-80 space-y-1">
              <label
                htmlFor="select-student-report"
                className="block text-xs font-bold text-[#26323B]"
              >
                اختيار الطالب من السجل المركزي ({students.length})
              </label>
              <select
                id="select-student-report"
                data-testid="select-student-report"
                value={selectedStudent?.id || ''}
                onChange={(e) => {
                  setSelectedStudentId(e.target.value);
                  setPdfPreviewPages([]);
                }}
                className="w-full min-h-[42px] rounded-xl border border-stone-300 bg-[#FAF7F5] px-3 py-2 text-xs sm:text-sm font-bold text-[#26323B] focus:border-[#7F1D3F] focus:outline-none"
              >
                {students.length === 0 ? (
                  <option value="">لا يوجد طلاب في السجل المركزي</option>
                ) : (
                  students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {s.grade}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {!selectedStudentReportData ? (
            <div
              data-testid="empty-student-report-state"
              className="rounded-xl border border-dashed border-stone-300 bg-[#FAF7F5] p-8 text-center space-y-2"
            >
              <p className="text-sm font-extrabold text-[#26323B]">
                لا يوجد طلاب مسجلون في السجل المركزي حالياً
              </p>
              <p className="text-xs text-stone-500">
                أضف الطلاب في قسم «01 الطلاب والطالبات» لإصدار تقاريرهم الفردية والتاريخية.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* البيانات المركزية للطالب (الحقول الاختيارية الفارغة لا تظهر) */}
              <div
                data-testid="student-report-central-card"
                className="rounded-xl border border-[#E6C7D0] bg-[#FAF7F5] p-4 sm:p-5 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h5
                    data-testid="student-report-name"
                    className="text-base sm:text-lg font-extrabold text-[#26323B]"
                  >
                    {selectedStudentReportData.student.name}
                  </h5>
                  <span className="px-3 py-1 rounded-lg bg-[#7F1D3F] text-white text-xs font-extrabold">
                    الصف الحالي: {selectedStudentReportData.student.grade}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {hasNonEmptyText(
                    selectedStudentReportData.student.civilId
                  ) && (
                    <div className="rounded-lg bg-white p-3 border border-stone-200">
                      <span className="block text-[11px] font-bold text-stone-500">
                        رقم الهوية الوطنية
                      </span>
                      <span className="text-xs sm:text-sm font-extrabold text-[#26323B] tabular-nums">
                        {selectedStudentReportData.student.civilId}
                      </span>
                    </div>
                  )}

                  {hasNonEmptyText(
                    selectedStudentReportData.student.gender
                  ) && (
                    <div className="rounded-lg bg-white p-3 border border-stone-200">
                      <span className="block text-[11px] font-bold text-stone-500">
                        الجنس
                      </span>
                      <span className="text-xs sm:text-sm font-extrabold text-[#26323B]">
                        {selectedStudentReportData.student.gender}
                      </span>
                    </div>
                  )}

                  <div className="rounded-lg bg-white p-3 border border-stone-200">
                    <span className="block text-[11px] font-bold text-stone-500">
                      العام الدراسي والفصل
                    </span>
                    <span className="text-xs sm:text-sm font-extrabold text-[#26323B]">
                      {selectedStudentReportData.student.academicYear ||
                        centralAcademicYear}{' '}
                      —{' '}
                      {selectedStudentReportData.student.semester ||
                        centralSemester}
                    </span>
                  </div>

                  {hasNonEmptyText(
                    selectedStudentReportData.student.studentMobile
                  ) && (
                    <div
                      data-testid="student-report-mobile-field"
                      className="rounded-lg bg-white p-3 border border-stone-200"
                    >
                      <span className="block text-[11px] font-bold text-stone-500">
                        جوال الطالب
                      </span>
                      <span className="text-xs sm:text-sm font-extrabold text-[#26323B] tabular-nums">
                        {selectedStudentReportData.student.studentMobile}
                      </span>
                    </div>
                  )}

                  {hasNonEmptyText(
                    selectedStudentReportData.student.guardianName
                  ) && (
                    <div
                      data-testid="student-report-guardian-field"
                      className="rounded-lg bg-white p-3 border border-stone-200"
                    >
                      <span className="block text-[11px] font-bold text-stone-500">
                        اسم ولي الأمر
                      </span>
                      <span className="text-xs sm:text-sm font-extrabold text-[#26323B]">
                        {selectedStudentReportData.student.guardianName}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* مشاركات الطالب في البرامج والتقارير والمبادرات (مع الصف التاريخي وقت المشاركة) */}
              <div className="space-y-3">
                <h5 className="text-sm font-extrabold text-[#26323B] flex items-center gap-2">
                  <Layers
                    className="w-4 h-4 text-[#7F1D3F]"
                    aria-hidden="true"
                  />
                  <span>
                    سجل المشاركات في البرامج والتقارير والمبادرات (
                    {selectedStudentReportData.section2Participations.length})
                  </span>
                </h5>

                {selectedStudentReportData.section2Participations.length ===
                0 ? (
                  <p className="text-xs text-stone-500 bg-[#FAF7F5] p-4 rounded-xl border border-stone-200">
                    لا توجد مشاركات مسجلة لهذا الطالب في البرامج والمبادرات حتى الآن.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-stone-200">
                    <table
                      data-testid="student-report-participations-table"
                      className="w-full text-right text-xs sm:text-sm"
                    >
                      <thead className="bg-[#26323B] text-white">
                        <tr>
                          <th className="px-3 py-2.5 font-bold">النوع</th>
                          <th className="px-3 py-2.5 font-bold">العنوان</th>
                          <th className="px-3 py-2.5 font-bold">
                            الصف وقت المشاركة
                          </th>
                          <th className="px-3 py-2.5 font-bold">الفترة</th>
                          {selectedStudentReportData.section2Participations.some(
                            (p) => hasNonEmptyText(p.statusRole)
                          ) && (
                            <th className="px-3 py-2.5 font-bold">
                              الصفة / الحالة
                            </th>
                          )}
                          {selectedStudentReportData.section2Participations.some(
                            (p) => hasNonEmptyText(p.participationType)
                          ) && (
                            <th className="px-3 py-2.5 font-bold">
                              نوع المشاركة
                            </th>
                          )}
                          {selectedStudentReportData.section2Participations.some(
                            (p) => hasNonEmptyText(p.scoreOrEvaluation)
                          ) && (
                            <th className="px-3 py-2.5 font-bold">
                              الدرجة / التقييم
                            </th>
                          )}
                          {selectedStudentReportData.section2Participations.some(
                            (p) => hasNonEmptyText(p.achievement)
                          ) && (
                            <th className="px-3 py-2.5 font-bold">الإنجاز</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-200 bg-white">
                        {selectedStudentReportData.section2Participations.map(
                          (p) => (
                            <tr key={p.key} className="hover:bg-[#FAF7F5]">
                              <td className="px-3 py-2.5 font-bold text-[#7F1D3F]">
                                {p.recordType}
                              </td>
                              <td className="px-3 py-2.5 font-extrabold text-[#26323B]">
                                {p.recordTitle}
                              </td>
                              <td
                                data-testid={`student-report-historical-grade-${p.recordId}`}
                                className="px-3 py-2.5 font-bold text-[#7F1D3F] bg-[#F9EFF2]/50"
                              >
                                {p.historicalGrade}
                              </td>
                              <td className="px-3 py-2.5 text-stone-600">
                                {p.academicYear} — {p.semester}
                              </td>
                              {selectedStudentReportData.section2Participations.some(
                                (x) => hasNonEmptyText(x.statusRole)
                              ) && (
                                <td className="px-3 py-2.5">
                                  {p.statusRole || ''}
                                </td>
                              )}
                              {selectedStudentReportData.section2Participations.some(
                                (x) => hasNonEmptyText(x.participationType)
                              ) && (
                                <td className="px-3 py-2.5">
                                  {p.participationType || ''}
                                </td>
                              )}
                              {selectedStudentReportData.section2Participations.some(
                                (x) => hasNonEmptyText(x.scoreOrEvaluation)
                              ) && (
                                <td className="px-3 py-2.5">
                                  {p.scoreOrEvaluation || ''}
                                </td>
                              )}
                              {selectedStudentReportData.section2Participations.some(
                                (x) => hasNonEmptyText(x.achievement)
                              ) && (
                                <td className="px-3 py-2.5">
                                  {p.achievement || ''}
                                </td>
                              )}
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* إنجازات الطالب وسجلات القسم الثالث */}
              {(selectedStudentReportData.achievementsList.length > 0 ||
                selectedStudentReportData.giftedLogEntries.length > 0 ||
                selectedStudentReportData.section3ProgramParticipations.length >
                  0) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {selectedStudentReportData.achievementsList.length > 0 && (
                    <div className="rounded-xl border border-stone-200 p-4 space-y-2.5">
                      <h6 className="text-xs sm:text-sm font-extrabold text-[#7F1D3F] flex items-center gap-1.5">
                        <Award className="w-4 h-4" aria-hidden="true" />
                        <span>
                          إنجازات الطالب (
                          {selectedStudentReportData.achievementsList.length})
                        </span>
                      </h6>
                      <div className="space-y-2">
                        {selectedStudentReportData.achievementsList.map((a) => (
                          <div
                            key={a.id}
                            className="rounded-lg bg-[#FAF7F5] p-3 border border-stone-200 text-xs space-y-1"
                          >
                            <div className="font-extrabold text-[#26323B]">
                              {a.achievement}
                            </div>
                            <div className="text-stone-600 flex flex-wrap gap-2">
                              <span>الجهة/المسابقة: {a.entityOrCompetition}</span>
                              <span>•</span>
                              <span>الصف وقت الإنجاز: {a.historicalGrade}</span>
                              {hasNonEmptyText(a.dateLabel) && (
                                <>
                                  <span>•</span>
                                  <span>{a.dateLabel}</span>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedStudentReportData.giftedLogEntries.length > 0 && (
                    <div className="rounded-xl border border-stone-200 p-4 space-y-2.5">
                      <h6 className="text-xs sm:text-sm font-extrabold text-[#7F1D3F] flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4" aria-hidden="true" />
                        <span>مجالات الموهبة المسجلة</span>
                      </h6>
                      <div className="space-y-2">
                        {selectedStudentReportData.giftedLogEntries.map((g) => (
                          <div
                            key={g.id}
                            className="rounded-lg bg-[#FAF7F5] p-3 border border-stone-200 text-xs space-y-1"
                          >
                            <div className="font-extrabold text-[#26323B]">
                              مجال الموهبة: {g.talentDomain}
                            </div>
                            <div className="text-stone-600">
                              الصف المسجل: {g.historicalGrade}
                            </div>
                            {hasNonEmptyText(g.notes) && (
                              <div className="text-stone-700">{g.notes}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* =====================================================================
          التقرير الثالث: ٣. تقرير دوري لأعمال المنسق
         ===================================================================== */}
      {activeReportKind === 'periodic_coordinator_report' && (
        <section
          data-testid="report-view-periodic_coordinator_report"
          className="rounded-2xl border border-[#E6C7D0] bg-white p-4 sm:p-6 shadow-xs space-y-6"
        >
          {renderOfficialMaktabiReportHeader()}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-stone-200">
            <div className="space-y-1">
              <h4 className="text-base sm:text-lg font-extrabold text-[#7F1D3F]">
                ٣. تقرير دوري لأعمال {terms.coordinatorSingular}
              </h4>
              <p className="text-xs text-stone-600">
                يعرض البرامج والتقارير والمبادرات والسجلات والنماذج المرتبطة بالفترة المختارة ({selectedAcademicYear} — {selectedSemester}).
              </p>
            </div>
            <span
              data-testid="periodic-report-active-period-badge"
              className="px-3 py-1.5 rounded-xl bg-[#F9EFF2] text-[#7F1D3F] border border-[#E6C7D0] text-xs font-extrabold"
            >
              الفترة المعروضة: {selectedAcademicYear} — {selectedSemester}
            </span>
          </div>

          {/* ملخص سريع لأعمال الفترة المختارة */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="rounded-xl border border-[#E6C7D0] bg-[#FAF7F5] p-3 text-center">
              <span className="block text-[11px] font-bold text-stone-500">
                البرامج والمبادرات
              </span>
              <span
                data-testid="periodic-count-unified-records"
                className="text-lg font-extrabold text-[#7F1D3F] tabular-nums"
              >
                {periodicReportData.periodProgramsAndRecords.length}
              </span>
            </div>
            <div className="rounded-xl border border-stone-200 bg-[#FAF7F5] p-3 text-center">
              <span className="block text-[11px] font-bold text-stone-500">
                سجل الموهوبين
              </span>
              <span className="text-lg font-extrabold text-[#26323B] tabular-nums">
                {periodicReportData.periodGiftedStudentsLog.length}
              </span>
            </div>
            <div className="rounded-xl border border-stone-200 bg-[#FAF7F5] p-3 text-center">
              <span className="block text-[11px] font-bold text-stone-500">
                مشاركات البرامج
              </span>
              <span className="text-lg font-extrabold text-[#26323B] tabular-nums">
                {periodicReportData.periodProgramParticipantsLog.length}
              </span>
            </div>
            <div className="rounded-xl border border-stone-200 bg-[#FAF7F5] p-3 text-center">
              <span className="block text-[11px] font-bold text-stone-500">
                سجل الإنجازات
              </span>
              <span className="text-lg font-extrabold text-[#26323B] tabular-nums">
                {periodicReportData.periodStudentAchievementsLog.length}
              </span>
            </div>
            <div className="rounded-xl border border-stone-200 bg-[#FAF7F5] p-3 text-center">
              <span className="block text-[11px] font-bold text-stone-500">
                الاجتماعات والزيارات
              </span>
              <span className="text-lg font-extrabold text-[#26323B] tabular-nums">
                {periodicReportData.periodMeetingsLog.length +
                  periodicReportData.periodVisitsLog.length}
              </span>
            </div>
            <div className="rounded-xl border border-stone-200 bg-[#FAF7F5] p-3 text-center">
              <span className="block text-[11px] font-bold text-stone-500">
                النماذج الجاهزة
              </span>
              <span className="text-lg font-extrabold text-[#26323B] tabular-nums">
                {periodicReportData.periodReadyTemplates.length}
              </span>
            </div>
          </div>

          {/* أ) البرامج والتقارير والمبادرات في الفترة المختارة */}
          <div className="space-y-3">
            <h5 className="text-sm font-extrabold text-[#26323B]">
              أولاً: البرامج والتقارير والمبادرات خلال ({selectedAcademicYear} —{' '}
              {selectedSemester})
            </h5>
            {periodicReportData.periodProgramsAndRecords.length === 0 ? (
              <p
                data-testid="periodic-empty-programs"
                className="text-xs text-stone-500 bg-[#FAF7F5] p-4 rounded-xl border border-stone-200"
              >
                لا توجد برامج أو تقارير أو مبادرات مسجلة في هذه الفترة ({selectedAcademicYear} — {selectedSemester}).
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-stone-200">
                <table
                  data-testid="periodic-programs-table"
                  className="w-full text-right text-xs sm:text-sm"
                >
                  <thead className="bg-[#26323B] text-white">
                    <tr>
                      <th className="px-3 py-2.5 font-bold">النوع</th>
                      <th className="px-3 py-2.5 font-bold">العنوان</th>
                      <th className="px-3 py-2.5 font-bold">التاريخ / المدة</th>
                      <th className="px-3 py-2.5 font-bold">عدد المشاركين</th>
                      <th className="px-3 py-2.5 font-bold">عدد الشواهد</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200 bg-white">
                    {periodicReportData.periodProgramsAndRecords.map((rec) => (
                      <tr key={rec.id} className="hover:bg-[#FAF7F5]">
                        <td className="px-3 py-2.5 font-bold text-[#7F1D3F]">
                          {rec.recordType}
                        </td>
                        <td className="px-3 py-2.5 font-extrabold text-[#26323B]">
                          {rec.title}
                        </td>
                        <td className="px-3 py-2.5">
                          {rec.hijriDate ||
                            rec.gregorianDate ||
                            rec.durationOption ||
                            ''}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums font-bold">
                          {(rec.participants || []).length}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums font-bold">
                          {(rec.evidences || []).length}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ب) الاجتماعات والزيارات والنماذج الجاهزة في الفترة */}
          {(periodicReportData.periodMeetingsLog.length > 0 ||
            periodicReportData.periodVisitsLog.length > 0 ||
            periodicReportData.periodReadyTemplates.length > 0) && (
            <div className="space-y-4">
              <h5 className="text-sm font-extrabold text-[#26323B]">
                ثانياً: الاجتماعات والزيارات والنماذج الجاهزة خلال الفترة
              </h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {periodicReportData.periodMeetingsLog.map((m) => (
                  <div
                    key={m.id}
                    className="rounded-xl border border-stone-200 bg-[#FAF7F5] p-4 space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between font-extrabold text-[#7F1D3F]">
                      <span>اجتماع: {m.topic}</span>
                      <span>{m.hijriDate || m.date}</span>
                    </div>
                    {m.attendees.length > 0 && (
                      <div className="text-stone-600">
                        الحضور:{' '}
                        {m.attendees
                          .map((a) =>
                            hasNonEmptyText(a.roleTitle)
                              ? `${a.name} (${a.roleTitle})`
                              : a.name
                          )
                          .join('، ')}
                      </div>
                    )}
                    {hasNonEmptyText(m.keyRecommendations) && (
                      <div className="text-[#26323B] font-semibold">
                        أبرز التوصيات: {m.keyRecommendations}
                      </div>
                    )}
                  </div>
                ))}

                {periodicReportData.periodVisitsLog.map((v) => (
                  <div
                    key={v.id}
                    className="rounded-xl border border-stone-200 bg-[#FAF7F5] p-4 space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between font-extrabold text-[#7F1D3F]">
                      <span>زيارة/شراكة: {v.entityOrPlace}</span>
                      <span>{v.hijriDate || v.date}</span>
                    </div>
                    {hasNonEmptyText(v.purpose) && (
                      <div className="text-stone-600">الغرض: {v.purpose}</div>
                    )}
                    {hasNonEmptyText(v.keyResults) && (
                      <div className="text-[#26323B] font-semibold">
                        أبرز النتائج: {v.keyResults}
                      </div>
                    )}
                  </div>
                ))}

                {periodicReportData.periodReadyTemplates.map((t) => (
                  <div
                    key={t.id}
                    className="rounded-xl border border-stone-200 bg-[#FAF7F5] p-4 space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between font-extrabold text-[#7F1D3F]">
                      <span>
                        [{t.templateKind}] {t.title}
                      </span>
                      <span>{t.hijriDate || t.date}</span>
                    </div>
                    {hasNonEmptyText(t.subjectOrPurpose) && (
                      <div className="text-stone-600">
                        الموضوع: {t.subjectOrPurpose}
                      </div>
                    )}
                    {hasNonEmptyText(t.bodyContent) && (
                      <div className="text-[#26323B]">{t.bodyContent}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ج) قسم مستقل لأرشيف الأعمال الإضافية السابق إن وجد */}
          {periodicReportData.legacyAdditionalWorks.length > 0 && (
            <div
              data-testid="periodic-legacy-additional-works-section"
              className="rounded-xl border border-[#E6C7D0] bg-[#FAF7F5] p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h5 className="text-sm font-extrabold text-[#7F1D3F]">
                  أرشيف الأعمال الإضافية السابق (قسم مستقل —{' '}
                  {periodicReportData.legacyAdditionalWorks.length})
                </h5>
                <span className="text-[11px] font-bold text-stone-500">
                  محتفظ به من الإصدارات السابقة
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {periodicReportData.legacyAdditionalWorks.map((w) => (
                  <div
                    key={w.id}
                    className="rounded-lg bg-white p-3 border border-stone-200 text-xs space-y-1"
                  >
                    <div className="font-extrabold text-[#26323B]">
                      {GIFTED_COORDINATOR_WORK_KIND_LABELS[w.workKind]}
                      {hasNonEmptyText(w.meetingNumber)
                        ? ` (${w.meetingNumber})`
                        : ''}
                    </div>
                    <div className="text-stone-600">{w.summary}</div>
                    {hasNonEmptyText(w.notesAndRecommendations) && (
                      <div className="text-stone-500">
                        {w.notesAndRecommendations}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* =====================================================================
          التقرير الرابع: ٤. التقرير الختامي للسجل (الأقسام السبعة المعتمدة)
         ===================================================================== */}
      {activeReportKind === 'final_record_report' && (
        <section
          data-testid="report-view-final_record_report"
          className="rounded-2xl border border-[#E6C7D0] bg-white p-4 sm:p-6 shadow-xs space-y-6"
        >
          {renderOfficialMaktabiReportHeader()}
          <div className="pb-4 border-b border-stone-200 space-y-1">
            <h4 className="text-base sm:text-lg font-extrabold text-[#7F1D3F]">
              ٤. التقرير الختامي للسجل (الأقسام السبعة المعتمدة)
            </h4>
            <p className="text-xs text-stone-600">
              يجمع التقرير الختامي كافة أركان سجل {terms.coordinatorSingular} في سبعة أقسام رسمية متكاملة.
            </p>
          </div>

          {/* القسم ١: غلاف رسمي */}
          <div
            data-testid="final-report-section-1-cover"
            className="rounded-2xl overflow-hidden border-2 border-[#7F1D3F] bg-gradient-to-l from-[#26323B] via-[#312332] to-[#7F1D3F] text-white p-6 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="px-3 py-1 rounded-lg bg-white/15 text-white text-xs font-extrabold">
                القسم ١ — غلاف رسمي
              </span>
              <span className="text-xs font-bold text-stone-200">
                المملكة العربية السعودية — وزارة التعليم
              </span>
            </div>
            <div className="text-center space-y-2 py-3">
              <h5 className="text-xl sm:text-2xl font-extrabold text-white">
                التقرير الختامي لسجل {terms.coordinatorSingular}
              </h5>
              <p className="text-xs sm:text-sm text-stone-200">
                {basicInfo.educationDepartment} — {basicInfo.schoolName}
              </p>
              <p className="text-xs sm:text-sm font-bold text-amber-200">
                العام الدراسي: {selectedAcademicYear} — {selectedSemester}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-white/20 text-xs sm:text-sm">
              <div className="bg-white/10 rounded-xl p-3">
                <span className="text-stone-300 block text-[11px]">
                  {basicInfo.coordinatorTitle}
                </span>
                <strong className="text-white">
                  {basicInfo.coordinatorName || 'غير محدد'}
                </strong>
              </div>
              <div className="bg-white/10 rounded-xl p-3">
                <span className="text-stone-300 block text-[11px]">
                  {basicInfo.principalTitle}
                </span>
                <strong className="text-white">
                  {basicInfo.principalName || 'غير محدد'}
                </strong>
              </div>
            </div>
          </div>

          {/* القسم ٢: فهرس */}
          <div
            data-testid="final-report-section-2-toc"
            className="rounded-xl border border-[#E6C7D0] bg-[#FAF7F5] p-4 sm:p-5 space-y-3"
          >
            <h5 className="text-sm sm:text-base font-extrabold text-[#7F1D3F] flex items-center gap-2">
              <BookOpen className="w-4 h-4" aria-hidden="true" />
              <span>القسم ٢ — فهرس التقرير الختامي</span>
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {FINAL_REPORT_SEVEN_APPROVED_SECTIONS.map((sec) => (
                <div
                  key={sec.id}
                  data-testid={`final-report-toc-item-${sec.id}`}
                  className="rounded-lg bg-white p-3 border border-stone-200 flex items-center gap-2.5"
                >
                  <span className="w-7 h-7 rounded-md bg-[#F9EFF2] text-[#7F1D3F] text-xs font-extrabold flex items-center justify-center shrink-0">
                    {sec.number}
                  </span>
                  <span className="text-xs sm:text-sm font-extrabold text-[#26323B]">
                    {sec.title}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* القسم ٣: بيانات الطلاب */}
          <div
            data-testid="final-report-section-3-students"
            className="rounded-xl border border-stone-200 p-4 sm:p-5 space-y-3"
          >
            <h5 className="text-sm sm:text-base font-extrabold text-[#7F1D3F] flex items-center gap-2">
              <Users className="w-4 h-4" aria-hidden="true" />
              <span>القسم ٣ — بيانات الطلاب ({students.length})</span>
            </h5>
            {students.length === 0 ? (
              <p className="text-xs text-stone-500">
                لا يوجد طلاب مسجلون في السجل المركزي حالياً.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-stone-200">
                <table className="w-full text-right text-xs sm:text-sm">
                  <thead className="bg-[#26323B] text-white">
                    <tr>
                      <th className="px-3 py-2 font-bold">#</th>
                      <th className="px-3 py-2 font-bold">الاسم الرباعي</th>
                      <th className="px-3 py-2 font-bold">رقم الهوية</th>
                      <th className="px-3 py-2 font-bold">الجنس</th>
                      <th className="px-3 py-2 font-bold">الصف</th>
                      <th className="px-3 py-2 font-bold">العام والفصل</th>
                      {students.some((s) => hasNonEmptyText(s.studentMobile)) && (
                        <th className="px-3 py-2 font-bold">جوال الطالب</th>
                      )}
                      {students.some((s) => hasNonEmptyText(s.guardianName)) && (
                        <th className="px-3 py-2 font-bold">ولي الأمر</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200 bg-white">
                    {students.map((st, idx) => (
                      <tr key={st.id} className="hover:bg-[#FAF7F5]">
                        <td className="px-3 py-2 font-bold tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="px-3 py-2 font-extrabold">{st.name}</td>
                        <td className="px-3 py-2 tabular-nums">
                          {st.civilId || ''}
                        </td>
                        <td className="px-3 py-2">{st.gender || ''}</td>
                        <td className="px-3 py-2 font-semibold text-[#7F1D3F]">
                          {st.grade}
                        </td>
                        <td className="px-3 py-2 text-stone-600">
                          {st.academicYear || centralAcademicYear} —{' '}
                          {st.semester || centralSemester}
                        </td>
                        {students.some((s) =>
                          hasNonEmptyText(s.studentMobile)
                        ) && (
                          <td className="px-3 py-2 tabular-nums">
                            {st.studentMobile || ''}
                          </td>
                        )}
                        {students.some((s) =>
                          hasNonEmptyText(s.guardianName)
                        ) && (
                          <td className="px-3 py-2">{st.guardianName || ''}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* القسم ٤: البرامج والتقارير والمبادرات */}
          <div
            data-testid="final-report-section-4-programs"
            className="rounded-xl border border-stone-200 p-4 sm:p-5 space-y-3"
          >
            <h5 className="text-sm sm:text-base font-extrabold text-[#7F1D3F] flex items-center gap-2">
              <Layers className="w-4 h-4" aria-hidden="true" />
              <span>
                القسم ٤ — البرامج والتقارير والمبادرات ({unifiedRecords.length})
              </span>
            </h5>
            {unifiedRecords.length === 0 ? (
              <p className="text-xs text-stone-500">
                لا توجد سجلات محفوظة في قسم البرامج والتقارير والمبادرات.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-stone-200">
                <table className="w-full text-right text-xs sm:text-sm">
                  <thead className="bg-[#26323B] text-white">
                    <tr>
                      <th className="px-3 py-2 font-bold">النوع</th>
                      <th className="px-3 py-2 font-bold">العنوان</th>
                      <th className="px-3 py-2 font-bold">التاريخ / المدة</th>
                      <th className="px-3 py-2 font-bold">الفترة</th>
                      <th className="px-3 py-2 font-bold">المشاركون</th>
                      <th className="px-3 py-2 font-bold">الشواهد</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200 bg-white">
                    {unifiedRecords.map((rec) => (
                      <tr key={rec.id} className="hover:bg-[#FAF7F5]">
                        <td className="px-3 py-2 font-bold text-[#7F1D3F]">
                          {rec.recordType}
                        </td>
                        <td className="px-3 py-2 font-extrabold">{rec.title}</td>
                        <td className="px-3 py-2">
                          {rec.hijriDate ||
                            rec.gregorianDate ||
                            rec.durationOption ||
                            ''}
                        </td>
                        <td className="px-3 py-2 text-stone-600">
                          {rec.academicYear} — {rec.semester}
                        </td>
                        <td className="px-3 py-2 font-bold tabular-nums">
                          {(rec.participants || []).length}
                        </td>
                        <td className="px-3 py-2 font-bold tabular-nums">
                          {(rec.evidences || []).length}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* القسم ٥: النماذج والسجلات */}
          <div
            data-testid="final-report-section-5-models-logs"
            className="rounded-xl border border-stone-200 p-4 sm:p-5 space-y-3"
          >
            <h5 className="text-sm sm:text-base font-extrabold text-[#7F1D3F] flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />
              <span>القسم ٥ — النماذج والسجلات</span>
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="rounded-lg bg-[#FAF7F5] p-3 border border-stone-200 flex items-center justify-between">
                <span className="text-xs font-bold">
                  {GIFTED_SECTION3_FIXED_LOG_LABELS.giftedStudentsLog}
                </span>
                <strong className="text-sm font-extrabold text-[#7F1D3F] tabular-nums">
                  {section3Data.giftedStudentsLog.length}
                </strong>
              </div>
              <div className="rounded-lg bg-[#FAF7F5] p-3 border border-stone-200 flex items-center justify-between">
                <span className="text-xs font-bold">
                  {GIFTED_SECTION3_FIXED_LOG_LABELS.programParticipantsLog}
                </span>
                <strong className="text-sm font-extrabold text-[#7F1D3F] tabular-nums">
                  {section3Data.programParticipantsLog.length}
                </strong>
              </div>
              <div className="rounded-lg bg-[#FAF7F5] p-3 border border-stone-200 flex items-center justify-between">
                <span className="text-xs font-bold">
                  {GIFTED_SECTION3_FIXED_LOG_LABELS.studentAchievementsLog}
                </span>
                <strong className="text-sm font-extrabold text-[#7F1D3F] tabular-nums">
                  {section3Data.studentAchievementsLog.length}
                </strong>
              </div>
              <div className="rounded-lg bg-[#FAF7F5] p-3 border border-stone-200 flex items-center justify-between">
                <span className="text-xs font-bold">
                  {GIFTED_SECTION3_FIXED_LOG_LABELS.meetingsLog}
                </span>
                <strong className="text-sm font-extrabold text-[#7F1D3F] tabular-nums">
                  {section3Data.meetingsLog.length}
                </strong>
              </div>
              <div className="rounded-lg bg-[#FAF7F5] p-3 border border-stone-200 flex items-center justify-between">
                <span className="text-xs font-bold">
                  {GIFTED_SECTION3_FIXED_LOG_LABELS.visitsAndPartnershipsLog}
                </span>
                <strong className="text-sm font-extrabold text-[#7F1D3F] tabular-nums">
                  {section3Data.visitsAndPartnershipsLog.length}
                </strong>
              </div>
              <div className="rounded-lg bg-[#FAF7F5] p-3 border border-stone-200 flex items-center justify-between">
                <span className="text-xs font-bold">النماذج الجاهزة الأربعة</span>
                <strong className="text-sm font-extrabold text-[#7F1D3F] tabular-nums">
                  {section3Data.readyTemplates.length}
                </strong>
              </div>
            </div>
          </div>

          {/* القسم ٦: الأدلة والمرفقات */}
          <div
            data-testid="final-report-section-6-evidences"
            className="rounded-xl border border-stone-200 p-4 sm:p-5 space-y-3"
          >
            <h5 className="text-sm sm:text-base font-extrabold text-[#7F1D3F] flex items-center gap-2">
              <FolderOpen className="w-4 h-4" aria-hidden="true" />
              <span>
                القسم ٦ — الأدلة والمرفقات (صور الشواهد + صفحات PDF + روابط QR)
              </span>
            </h5>
            {renderVisualEvidencesAndLinksGrid(
              allFinalReportVisualEvidences,
              allFinalReportLinks,
              'final-report'
            )}
          </div>

          {/* القسم ٧: الإحصاءات ذات الصلة */}
          <div
            data-testid="final-report-section-7-statistics"
            className="rounded-xl border border-[#E6C7D0] bg-[#FAF7F5] p-4 sm:p-5 space-y-3"
          >
            <h5 className="text-sm sm:text-base font-extrabold text-[#7F1D3F] flex items-center gap-2">
              <BarChart3 className="w-4 h-4" aria-hidden="true" />
              <span>القسم ٧ — الإحصاءات ذات الصلة</span>
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-lg bg-white p-3.5 border border-stone-200">
                <span className="block text-[11px] font-bold text-stone-500">
                  إجمالي الطلاب بالسجل المركزي
                </span>
                <strong className="text-lg font-extrabold text-[#7F1D3F] tabular-nums">
                  {studentStatisticalReportData.totalCentralStudents}
                </strong>
              </div>
              <div className="rounded-lg bg-white p-3.5 border border-stone-200">
                <span className="block text-[11px] font-bold text-stone-500">
                  الطلاب المستفيدون فعلياً
                </span>
                <strong className="text-lg font-extrabold text-[#26323B] tabular-nums">
                  {studentStatisticalReportData.uniqueBeneficiaryStudentsCount}
                </strong>
              </div>
              <div className="rounded-lg bg-white p-3.5 border border-stone-200">
                <span className="block text-[11px] font-bold text-stone-500">
                  إجمالي المشاركات (دون تكرار)
                </span>
                <strong className="text-lg font-extrabold text-[#26323B] tabular-nums">
                  {studentStatisticalReportData.deduplicatedParticipationsCount}
                </strong>
              </div>
              <div className="rounded-lg bg-white p-3.5 border border-stone-200">
                <span className="block text-[11px] font-bold text-stone-500">
                  نسبة إجراءات البرامج الوزارية
                </span>
                <strong className="text-lg font-extrabold text-[#7F1D3F] tabular-nums">
                  {
                    studentStatisticalReportData.ministerialProgramsStats
                      .ministerialActionsCompletionPct
                  }
                  %
                </strong>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* =====================================================================
          التقرير الخامس: ٥. التقرير الإحصائي للطلاب
         ===================================================================== */}
      {activeReportKind === 'statistical_students_report' && (
        <section
          data-testid="report-view-statistical_students_report"
          className="rounded-2xl border border-[#E6C7D0] bg-white p-4 sm:p-6 shadow-xs space-y-6"
        >
          {renderOfficialMaktabiReportHeader()}
          <div className="pb-4 border-b border-stone-200 space-y-1">
            <h4 className="text-base sm:text-lg font-extrabold text-[#7F1D3F]">
              ٥. التقرير الإحصائي للطلاب
            </h4>
            <p className="text-xs text-stone-600">
              يعتمد مباشرة على السجل المركزي للطلاب ومعادلات المؤشرات المعتمدة، مع الفصل الواضح بين إحصاءات البرامج الوزارية وإحصاءات المسابقات والمبادرات دون ازدواجية في العد.
            </p>
          </div>

          {/* ١. المؤشرات الرئيسية للسجل المركزي للطلاب */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="rounded-xl border border-[#E6C7D0] bg-[#FAF7F5] p-4 space-y-1">
              <span className="text-xs font-bold text-stone-600">
                إجمالي الطلاب في السجل المركزي
              </span>
              <div
                data-testid="stat-report-total-central-students"
                className="text-2xl font-extrabold text-[#7F1D3F] tabular-nums"
              >
                {studentStatisticalReportData.totalCentralStudents}
              </div>
              <p className="text-[11px] text-stone-500">
                في الفترة المختارة ({selectedAcademicYear} — {selectedSemester}):{' '}
                {studentStatisticalReportData.periodStudentsCount}
              </p>
            </div>

            <div className="rounded-xl border border-stone-200 bg-[#FAF7F5] p-4 space-y-1">
              <span className="text-xs font-bold text-stone-600">
                الطلاب المستفيدون (دون ازدواجية)
              </span>
              <div
                data-testid="stat-report-unique-beneficiaries"
                className="text-2xl font-extrabold text-[#26323B] tabular-nums"
              >
                {studentStatisticalReportData.uniqueBeneficiaryStudentsCount}
              </div>
              <p className="text-[11px] text-stone-500">
                طالب: {studentStatisticalReportData.maleCount} | طالبة:{' '}
                {studentStatisticalReportData.femaleCount}
              </p>
            </div>

            <div className="rounded-xl border border-stone-200 bg-[#FAF7F5] p-4 space-y-1">
              <span className="text-xs font-bold text-stone-600">
                إجمالي المشاركات غير المكررة
              </span>
              <div
                data-testid="stat-report-deduplicated-participations"
                className="text-2xl font-extrabold text-[#26323B] tabular-nums"
              >
                {studentStatisticalReportData.deduplicatedParticipationsCount}
              </div>
              <p className="text-[11px] text-stone-500">
                محسوبة دون تكرار الطالب في نفس البرنامج
              </p>
            </div>

            <div className="rounded-xl border border-stone-200 bg-[#FAF7F5] p-4 space-y-1">
              <span className="text-xs font-bold text-stone-600">
                إجمالي الإنجازات الموثقة
              </span>
              <div
                data-testid="stat-report-deduplicated-achievements"
                className="text-2xl font-extrabold text-[#7F1D3F] tabular-nums"
              >
                {studentStatisticalReportData.deduplicatedAchievementsCount}
              </div>
              <p className="text-[11px] text-stone-500">
                مجمعة من سجل الإنجازات والمشاركات
              </p>
            </div>
          </div>

          {/* ٢. الفصل الإلزامي: (أ) إحصاءات البرامج الوزارية مقابل (ب) إحصاءات المسابقات والمبادرات */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div
              data-testid="stat-report-ministerial-programs-box"
              className="rounded-xl border-2 border-[#7F1D3F]/30 bg-[#F9EFF2]/40 p-4 sm:p-5 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h5 className="text-sm sm:text-base font-extrabold text-[#7F1D3F] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  <span>أولاً: إحصاءات البرامج الوزارية (مستقلة)</span>
                </h5>
                <span className="px-2.5 py-0.5 rounded bg-[#7F1D3F] text-white text-[11px] font-bold">
                  برامج وزارية
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg bg-white p-3 border border-[#E6C7D0]">
                  <span className="block text-stone-500 font-bold">
                    البرامج الوزارية المطبقة
                  </span>
                  <strong className="text-base font-extrabold text-[#26323B] tabular-nums">
                    {
                      studentStatisticalReportData.ministerialProgramsStats
                        .applicableMinisterialProgramsCount
                    }
                  </strong>
                </div>
                <div className="rounded-lg bg-white p-3 border border-[#E6C7D0]">
                  <span className="block text-stone-500 font-bold">
                    نسبة إنجاز الإجراءات الوزارية
                  </span>
                  <strong className="text-base font-extrabold text-[#7F1D3F] tabular-nums">
                    {
                      studentStatisticalReportData.ministerialProgramsStats
                        .ministerialActionsCompletionPct
                    }
                    % (
                    {
                      studentStatisticalReportData.ministerialProgramsStats
                        .ministerialExecutedActionsCount
                    }
                    /
                    {
                      studentStatisticalReportData.ministerialProgramsStats
                        .ministerialTotalActionsCount
                    }
                    )
                  </strong>
                </div>
                <div className="rounded-lg bg-white p-3 border border-[#E6C7D0]">
                  <span className="block text-stone-500 font-bold">
                    سجلات البرامج بنطاق وزاري (قسم 02)
                  </span>
                  <strong className="text-base font-extrabold text-[#26323B] tabular-nums">
                    {
                      studentStatisticalReportData.ministerialProgramsStats
                        .unifiedMinisterialScopeProgramsCount
                    }
                  </strong>
                </div>
                <div className="rounded-lg bg-white p-3 border border-[#E6C7D0]">
                  <span className="block text-stone-500 font-bold">
                    برامج إدارة تعليم / مدرسة (قسم 02)
                  </span>
                  <strong className="text-base font-extrabold text-[#26323B] tabular-nums">
                    {studentStatisticalReportData.ministerialProgramsStats
                      .unifiedEducationDeptProgramsCount +
                      studentStatisticalReportData.ministerialProgramsStats
                        .unifiedSchoolScopeProgramsCount}
                  </strong>
                </div>
              </div>
            </div>

            <div
              data-testid="stat-report-competitions-initiatives-box"
              className="rounded-xl border border-stone-300 bg-[#FAF7F5] p-4 sm:p-5 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h5 className="text-sm sm:text-base font-extrabold text-[#26323B] flex items-center gap-2">
                  <Award className="w-4 h-4 text-[#7F1D3F]" aria-hidden="true" />
                  <span>ثانياً: إحصاءات المسابقات والمبادرات (مستقلة)</span>
                </h5>
                <span className="px-2.5 py-0.5 rounded bg-[#26323B] text-white text-[11px] font-bold">
                  مسابقات ومبادرات
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg bg-white p-3 border border-stone-200">
                  <span className="block text-stone-500 font-bold">
                    المبادرات الموثقة (قسم 02)
                  </span>
                  <strong className="text-base font-extrabold text-[#7F1D3F] tabular-nums">
                    {
                      studentStatisticalReportData
                        .initiativesAndCompetitionsStats.unifiedInitiativesCount
                    }
                  </strong>
                </div>
                <div className="rounded-lg bg-white p-3 border border-stone-200">
                  <span className="block text-stone-500 font-bold">
                    التقارير الموثقة (قسم 02)
                  </span>
                  <strong className="text-base font-extrabold text-[#26323B] tabular-nums">
                    {
                      studentStatisticalReportData
                        .initiativesAndCompetitionsStats.unifiedReportsCount
                    }
                  </strong>
                </div>
                <div className="rounded-lg bg-white p-3 border border-stone-200">
                  <span className="block text-stone-500 font-bold">
                    المسابقات العلمية المنفذة
                  </span>
                  <strong className="text-base font-extrabold text-[#26323B] tabular-nums">
                    {
                      studentStatisticalReportData
                        .initiativesAndCompetitionsStats
                        .scientificCompetitionsExecuted
                    }{' '}
                    من{' '}
                    {
                      studentStatisticalReportData
                        .initiativesAndCompetitionsStats
                        .scientificCompetitionsTotal
                    }
                  </strong>
                </div>
                <div className="rounded-lg bg-white p-3 border border-stone-200">
                  <span className="block text-stone-500 font-bold">
                    نسبة إنجاز الخطة التنفيذية
                  </span>
                  <strong className="text-base font-extrabold text-[#7F1D3F] tabular-nums">
                    {
                      studentStatisticalReportData.kpiSummary
                        .executivePlanMetrics.completionPercentage
                    }
                    %
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* ٣. جدول توزيع الطلاب حسب الصف الدراسي */}
          <div className="space-y-3">
            <h5 className="text-sm font-extrabold text-[#26323B]">
              ثالثاً: توزيع الطلاب في السجل المركزي حسب الصف الدراسي
            </h5>
            {studentStatisticalReportData.distributionByGrade.length === 0 ? (
              <p className="text-xs text-stone-500 bg-[#FAF7F5] p-4 rounded-xl border border-stone-200">
                لا توجد بيانات طلاب لعرض التوزيع الإحصائي حسب الصف.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-stone-200">
                <table
                  data-testid="stat-report-grade-distribution-table"
                  className="w-full text-right text-xs sm:text-sm"
                >
                  <thead className="bg-[#26323B] text-white">
                    <tr>
                      <th className="px-3 py-2.5 font-bold">الصف الدراسي</th>
                      <th className="px-3 py-2.5 font-bold">عدد الطلاب</th>
                      <th className="px-3 py-2.5 font-bold">النسبة المئوية</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200 bg-white">
                    {studentStatisticalReportData.distributionByGrade.map(
                      (row) => (
                        <tr key={row.grade} className="hover:bg-[#FAF7F5]">
                          <td className="px-3 py-2.5 font-extrabold text-[#26323B]">
                            {row.grade}
                          </td>
                          <td className="px-3 py-2.5 font-bold tabular-nums">
                            {row.count}
                          </td>
                          <td className="px-3 py-2.5 font-bold text-[#7F1D3F] tabular-nums">
                            {row.percentage}%
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
};
