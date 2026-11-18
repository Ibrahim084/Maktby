import { SchoolSettings } from '../types';
import {
  EvidenceImageItem,
  ExportFormat,
  FormDefinition,
  FormValues,
  TableRowData,
} from '../types/forms';
import { isFieldVisible, resolveReportFieldValue } from './formEngine';
import { generateStandardReportPdfBytes } from './reportPdfGenerator';
import { getGenderedLabels, getRoleForSection } from './settingsStorage';
import {
  buildCertificatePdfFilesAsync,
  buildTraineeCertificateFiles,
  createZipArchiveBytes,
  sanitizeFilenameSegment,
  ZipFileEntry,
} from './zipBuilder';

export interface ExportReportPayload {
  form: FormDefinition;
  values: FormValues;
  settings: SchoolSettings;
}

export interface ExportResult {
  success: boolean;
  format: ExportFormat;
  message: string;
  filename?: string;
}

export type ExportAdapter = (payload: ExportReportPayload) => Promise<ExportResult> | ExportResult;

function formatFieldValueAsText(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value.trim() || '—';
  if (Array.isArray(value)) {
    if (value.length === 0) return '—';
    const first = value[0];
    if (typeof first === 'string') {
      return (value as string[]).filter((v) => v.trim().length > 0).join(' ، ') || '—';
    }
  }
  return '—';
}

export function buildSpreadsheetCsvContent(payload: ExportReportPayload): string {
  const { form, values, settings } = payload;
  const rawRole = getRoleForSection(settings, form.sectionId);
  const { principalTitle } = getGenderedLabels(settings.gender);
  const roleTitle =
    rawRole ||
    (form.sectionId === 'teacher'
      ? 'المعلم'
      : form.sectionId === 'gifted'
      ? 'منسق الموهوبين'
      : 'منسق التطوير المهني');
  const lines: string[][] = [];

  lines.push(['عنوان التقرير', form.reportTitle || form.title]);
  lines.push(['الإدارة التعليمية', settings.educationDepartment || 'غير محدد']);
  lines.push(['المدرسة', settings.schoolName || 'غير محدد']);
  lines.push([
    'العام الدراسي',
    (typeof values.academicYearInput === 'string' && values.academicYearInput.trim()) ||
      settings.academicYear ||
      'غير محدد',
  ]);
  lines.push([roleTitle, settings.userName || 'غير محدد']);
  lines.push([principalTitle, settings.principalName || 'غير محدد']);
  lines.push([]);

  for (const field of form.fields) {
    if (
      !isFieldVisible(field, values) ||
      field.type === 'signature' ||
      field.id === 'customExecutionDomain'
    ) {
      continue;
    }
    const val = resolveReportFieldValue(field, values);
    if (field.type === 'table') {
      const cols = field.columns ?? [];
      const rows = Array.isArray(val) ? (val as TableRowData[]) : [];
      lines.push([field.label]);
      lines.push(cols.map((c) => c.label));
      for (const row of rows) {
        lines.push(cols.map((c) => (row[c.key] ?? '').trim()));
      }
      lines.push([]);
    } else if (field.type === 'repeatable') {
      const items = Array.isArray(val) ? (val as string[]) : [];
      lines.push([field.label, items.filter((i) => i.trim()).join(' | ') || '—']);
    } else if (field.type === 'images') {
      const imgs = Array.isArray(val) ? (val as EvidenceImageItem[]) : [];
      lines.push([field.label, `${imgs.length} شواهد مرفقة`]);
    } else {
      lines.push([field.label, formatFieldValueAsText(val)]);
    }
  }

  lines.push([]);
  lines.push([`معد التقرير (${roleTitle})`, settings.userName || 'غير محدد']);

  const escapeCsvCell = (cell: string) => `"${String(cell ?? '').replace(/"/g, '""')}"`;
  return '\uFEFF' + lines.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
}

export function buildDocHtmlContent(payload: ExportReportPayload): string {
  const { form, values, settings } = payload;
  const rawRole = getRoleForSection(settings, form.sectionId);
  const { principalTitle } = getGenderedLabels(settings.gender);
  const roleTitle =
    rawRole ||
    (form.sectionId === 'teacher'
      ? 'المعلم'
      : form.sectionId === 'gifted'
      ? 'منسق الموهوبين'
      : 'منسق التطوير المهني');

  const escapeHtml = (str: string) =>
    String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const visibleFields = form.fields.filter(
    (f) =>
      isFieldVisible(f, values) &&
      !f.hideInReportBody &&
      f.type !== 'signature'
  );

  const bodyRows = visibleFields
    .map((field) => {
      const val = resolveReportFieldValue(field, values);
      if (field.type === 'table') {
        const cols = field.columns ?? [];
        const rows = Array.isArray(val) ? (val as TableRowData[]) : [];
        const headerHtml = cols
          .map(
            (c) =>
              `<th style="border:1px solid #d6d3d1;padding:8px;background:#f5f5f4;">${escapeHtml(
                c.label
              )}</th>`
          )
          .join('');
        const rowsHtml = rows
          .map(
            (r) =>
              `<tr>${cols
                .map(
                  (c) =>
                    `<td style="border:1px solid #d6d3d1;padding:8px;">${escapeHtml(
                      r[c.key] || '—'
                    )}</td>`
                )
                .join('')}</tr>`
          )
          .join('');
        return `<div style="margin-bottom:16px;">
          <h3 style="font-size:14pt;margin-bottom:6px;">${escapeHtml(field.label)}</h3>
          <table dir="rtl" style="width:100%;border-collapse:collapse;font-size:12pt;">
            <thead><tr>${headerHtml}</tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>`;
      }
      if (field.type === 'repeatable') {
        const items = (Array.isArray(val) ? (val as string[]) : []).filter((i) =>
          i.trim()
        );
        const listHtml =
          items.length > 0
            ? `<ol style="margin:4px 0 12px 0;padding-right:20px;">${items
                .map((item) => `<li>${escapeHtml(item)}</li>`)
                .join('')}</ol>`
            : '<p>—</p>';
        return `<div style="margin-bottom:14px;"><strong>${escapeHtml(
          field.label
        )}:</strong>${listHtml}</div>`;
      }
      if (field.type === 'images') {
        const imgs = Array.isArray(val) ? (val as EvidenceImageItem[]) : [];
        return `<div style="margin-bottom:14px;"><strong>${escapeHtml(
          field.label
        )}:</strong> عدد الصور المرفقة (${imgs.length})</div>`;
      }
      return `<div style="margin-bottom:10px;"><strong>${escapeHtml(
        field.label
      )}:</strong> <span>${escapeHtml(formatFieldValueAsText(val))}</span></div>`;
    })
    .join('');

  const executorSectionHtml =
    form.footerMode === 'executor'
      ? `<div style="border:1px solid #d6d3d1;border-radius:8px;padding:12px;margin-top:20px;background:#fafaf9;">
          <h3 style="font-size:13pt;margin:0 0 8px 0;">بيانات منفذ البرنامج</h3>
          <div style="display:flex;justify-content:space-between;gap:12px;">
            <div><strong>اسم منفذ البرنامج:</strong> ${escapeHtml(
              formatFieldValueAsText(values.executorName)
            )}</div>
            <div><strong>رقم السجل المدني:</strong> ${escapeHtml(
              formatFieldValueAsText(values.executorNationalId)
            )}</div>
            <div><strong>التوقيع:</strong> ________________</div>
          </div>
        </div>`
      : '';

  const footerHtml = `<div style="border-top:2px solid #d6d3d1;margin-top:28px;padding-top:14px;display:flex;justify-content:space-between;">
    <div><strong>معد التقرير (${escapeHtml(roleTitle)}):</strong> ${escapeHtml(
    settings.userName || 'غير محدد'
  )}</div>
  </div>`;

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(form.reportTitle || form.title)}</title>
</head>
<body dir="rtl" style="font-family:'Tajawal','Arial',sans-serif;font-size:13pt;color:#1c1917;line-height:1.7;">
  <div style="border-bottom:2px solid #44403c;padding-bottom:12px;margin-bottom:20px;">
    <div><strong>المملكة العربية السعودية — وزارة التعليم</strong></div>
    <div>الإدارة التعليمية: ${escapeHtml(
      settings.educationDepartment || 'غير محدد'
    )}</div>
    <div>المدرسة: ${escapeHtml(settings.schoolName || 'غير محدد')}</div>
    <div>العام الدراسي: ${escapeHtml(
      (typeof values.academicYearInput === 'string' &&
        values.academicYearInput.trim()) ||
        settings.academicYear ||
        'غير محدد'
    )}</div>
    <div style="margin-top:8px;padding-top:8px;border-top:1px dashed #d6d3d1;display:flex;justify-content:space-between;">
      <div><strong>${escapeHtml(roleTitle)}:</strong> ${escapeHtml(
    settings.userName || 'غير محدد'
  )}</div>
      <div><strong>${escapeHtml(principalTitle)}:</strong> ${escapeHtml(
    settings.principalName || 'غير محدد'
  )}</div>
    </div>
  </div>
  <h1 style="font-size:18pt;text-align:center;margin-bottom:20px;">${escapeHtml(
    form.reportTitle || form.title
  )}</h1>
  <div>${bodyRows}</div>
  ${executorSectionHtml}
  ${footerHtml}
</body>
</html>`;
}

export function triggerBlobDownload(
  content: string | Uint8Array,
  mimeType: string,
  filename: string
) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const blobPart =
    content instanceof Uint8Array
      ? (content.buffer.slice(
          content.byteOffset,
          content.byteOffset + content.byteLength
        ) as ArrayBuffer)
      : content;
  const blob = new Blob([blobPart], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function downloadSingleCertificateFile(entry: ZipFileEntry): void {
  triggerBlobDownload(entry.content, 'application/pdf', entry.filename);
}

export async function downloadBatchCertificatesZipAsync(
  traineeNames: string[],
  values: FormValues,
  settings: SchoolSettings,
  existingFiles?: ZipFileEntry[]
): Promise<{
  count: number;
  zipFilename: string;
  files: ZipFileEntry[];
  zipBytes: Uint8Array;
}> {
  const files =
    existingFiles && existingFiles.length > 0
      ? existingFiles
      : await buildCertificatePdfFilesAsync(
          'trainee',
          values,
          settings,
          traineeNames
        );
  const zipBytes = createZipArchiveBytes(files);
  const rawProgram =
    typeof values.programTitle === 'string' && values.programTitle.trim()
      ? values.programTitle.trim()
      : 'برنامج_تدريبي';
  const safeProgram = sanitizeFilenameSegment(rawProgram) || 'برنامج';
  const zipFilename = `شهادات_متدربين_${safeProgram}_${files.length}.zip`;
  triggerBlobDownload(zipBytes, 'application/zip', zipFilename);
  return {
    count: files.length,
    zipFilename,
    files,
    zipBytes,
  };
}

export function downloadBatchCertificatesZip(
  traineeNames: string[],
  values: FormValues,
  settings: SchoolSettings
): { count: number; zipFilename: string; files: ZipFileEntry[] } {
  const files = buildTraineeCertificateFiles(traineeNames, values, settings);
  const zipBytes = createZipArchiveBytes(files);
  const rawProgram =
    typeof values.programTitle === 'string' && values.programTitle.trim()
      ? values.programTitle.trim()
      : 'برنامج_تدريبي';
  const safeProgram = sanitizeFilenameSegment(rawProgram) || 'برنامج';
  const zipFilename = `شهادات_متدربين_${safeProgram}_${files.length}.zip`;
  triggerBlobDownload(zipBytes, 'application/zip', zipFilename);
  return {
    count: files.length,
    zipFilename,
    files,
  };
}

const exportAdapters: Record<ExportFormat, ExportAdapter> = {
  pdf: async (payload) => {
    const { form, values, settings } = payload;
    if (
      form.templateLayout === 'certificate-trainer' ||
      form.templateLayout === 'certificate-trainee'
    ) {
      const variant =
        form.templateLayout === 'certificate-trainer' ? 'trainer' : 'trainee';
      const files = await buildCertificatePdfFilesAsync(
        variant,
        values,
        settings
      );

      if (files.length === 1) {
        triggerBlobDownload(
          files[0].content,
          'application/pdf',
          files[0].filename
        );
        return {
          success: true,
          format: 'pdf',
          filename: files[0].filename,
          message: `تم إنشاء وتنزيل ملف الشهادة بصيغة PDF فعلية (${files[0].filename}) بمقاس A4 أفقي.`,
        };
      } else if (files.length > 1) {
        const zipRes = await downloadBatchCertificatesZipAsync(
          [],
          values,
          settings,
          files
        );
        return {
          success: true,
          format: 'pdf',
          filename: zipRes.zipFilename,
          message: `تم إصدار (${files.length}) ملفات PDF مستقلة وتنزيلها في ملف مضغوط (${zipRes.zipFilename}).`,
        };
      }
    }

    const reportPdf = await generateStandardReportPdfBytes(
      form,
      values,
      settings
    );
    triggerBlobDownload(
      reportPdf.pdfBytes,
      'application/pdf',
      reportPdf.filename
    );
    return {
      success: true,
      format: 'pdf',
      filename: reportPdf.filename,
      message: `تم إنشاء وتنزيل ملف التقرير بصيغة PDF فعلية (${reportPdf.filename}) بمقاس A4.`,
    };
  },
  docx: (payload) => {
    const html = buildDocHtmlContent(payload);
    const safeName = (
      payload.form.reportTitle ||
      payload.form.title ||
      'report'
    ).replace(/\s+/g, '-');
    triggerBlobDownload(
      html,
      'application/msword;charset=utf-8',
      `${safeName}.doc`
    );
    return {
      success: true,
      format: 'docx',
      message: 'تم تجهيز وتصدير ملف المستند النصي المتوافق مع Word بنجاح.',
    };
  },
  xlsx: (payload) => {
    const csv = buildSpreadsheetCsvContent(payload);
    const safeName = (
      payload.form.reportTitle ||
      payload.form.title ||
      'report'
    ).replace(/\s+/g, '-');
    triggerBlobDownload(csv, 'text/csv;charset=utf-8', `${safeName}.csv`);
    return {
      success: true,
      format: 'xlsx',
      message: 'تم تجهيز وتصدير ملف السجل والجدول المتوافق مع Excel بنجاح.',
    };
  },
};

export function registerExportAdapter(
  format: ExportFormat,
  adapter: ExportAdapter
): void {
  exportAdapters[format] = adapter;
}

export async function executeReportExport(
  format: ExportFormat,
  payload: ExportReportPayload
): Promise<ExportResult> {
  const adapter = exportAdapters[format];
  return await adapter(payload);
}
