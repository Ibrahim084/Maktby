import React from 'react';
import { SECTIONS } from '../../data/sections';
import { SchoolSettings } from '../../types';
import {
  EvidenceImageItem,
  FormDefinition,
  FormValues,
  TableRowData,
} from '../../types/forms';
import {
  buildOfficialCertificateContent,
  parseCertificateBeneficiaries,
} from '../../utils/certificatePdfGenerator';
import { isFieldVisible, resolveReportFieldValue } from '../../utils/formEngine';
import {
  getGenderedLabels,
  getRoleForSection,
} from '../../utils/settingsStorage';

interface ReportTemplateProps {
  form: FormDefinition;
  values: FormValues;
  settings: SchoolSettings;
}

export const ReportTemplate: React.FC<ReportTemplateProps> = ({
  form,
  values,
  settings,
}) => {
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

  const isLandscape = form.orientation === 'landscape';
  const layout = form.templateLayout ?? 'standard-report';
  const footerMode = form.footerMode ?? 'default';

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

  const renderScalarValue = (val: unknown): string => {
    if (val === null || val === undefined) return '—';
    if (typeof val === 'string') return val.trim() || '—';
    if (Array.isArray(val)) {
      const cleaned = (val as string[]).filter(
        (item) => typeof item === 'string' && item.trim().length > 0
      );
      return cleaned.length > 0 ? cleaned.join(' ، ') : '—';
    }
    return '—';
  };

  const effectiveAcademicYear =
    (typeof values.academicYearInput === 'string' &&
      values.academicYearInput.trim()) ||
    settings.academicYear ||
    'غير محدد';

  // Official Trainer & Trainee Certificate Layout (Matching the attached Ministry reference templates)
  if (layout === 'certificate-trainer' || layout === 'certificate-trainee') {
    const isTrainer = layout === 'certificate-trainer';
    const variant = isTrainer ? 'trainer' : 'trainee';
    const parsedBeneficiaries = parseCertificateBeneficiaries(values, !isTrainer);
    const beneficiaryEntries =
      parsedBeneficiaries.length > 0
        ? parsedBeneficiaries
        : [{ name: 'غير محدد', nationalId: '—' }];

    return (
      <div className="space-y-8 print:space-y-0">
        {beneficiaryEntries.map((beneficiary, certIndex) => {
          const certContent = buildOfficialCertificateContent(
            variant,
            beneficiary,
            values,
            settings
          );

          return (
            <article
              key={`${beneficiary.name}-${certIndex}`}
              dir="rtl"
              data-testid={
                certIndex === 0
                  ? 'report-template-a4'
                  : `report-template-a4-${certIndex + 1}`
              }
              data-certificate-item="true"
              data-certificate-variant={variant}
              data-certificate-gender={gendered.gender}
              className="report-print-sheet [container-type:inline-size] relative w-full max-w-[297mm] aspect-[297/210] bg-white text-zinc-900 mx-auto overflow-hidden border border-stone-200 rounded-xl print:border-0 print:rounded-none select-none print:break-after-page last:print:break-after-auto"
            >
              {/* Clean High-Resolution Official Background Image (MoE Logo, Gold Seal, Left Hexagons, Right Honeycomb Cells, Bottom Gradient Line) */}
              <img
                src={certContent.backgroundUrl}
                alt={isTrainer ? 'خلفية شهادة مدرب الرسمية' : 'خلفية شهادة متدرب الرسمية'}
                data-testid={`certificate-bg-${variant}`}
                className="absolute inset-0 w-full h-full object-fill pointer-events-none"
              />

              {/* Programmatic Official Text Layer Overlaid on the Clean Background */}
              <div className="relative z-10 w-full h-full flex flex-col justify-between">
                {/* Main Central Certificate Lines (Positioned to match the official reference template) */}
                <div
                  data-testid={`certificate-body-text-${certIndex + 1}`}
                  className="w-[66%] mx-auto mt-[18.5%] text-center space-y-[1.8%] text-[#18181b] font-bold leading-relaxed"
                  style={{
                    fontFamily: '"Tajawal", "Cairo", sans-serif',
                    fontSize: 'clamp(7px, 1.85cqw, 21px)',
                  }}
                >
                  <p
                    data-testid={`certificate-line-1-${certIndex + 1}`}
                    className="break-words"
                  >
                    {certContent.line1}
                  </p>
                  <p
                    data-testid={`certificate-line-2-${certIndex + 1}`}
                    className="tabular-nums"
                  >
                    {certContent.line2}
                  </p>
                  <p
                    data-testid={`certificate-line-3-${certIndex + 1}`}
                    className="break-words"
                  >
                    {certContent.line3}
                  </p>
                  <p
                    data-testid={`certificate-line-4-${certIndex + 1}`}
                    className="tabular-nums"
                  >
                    {certContent.line4}
                  </p>
                  <p
                    data-testid={`certificate-line-5-${certIndex + 1}`}
                    className="tabular-nums"
                  >
                    {certContent.line5}
                  </p>
                  <p data-testid={`certificate-line-6-${certIndex + 1}`}>
                    {certContent.line6}
                  </p>
                </div>

                {/* Official Bottom Stamp & Principal Positions (Matching the attached reference template) */}
                <div
                  className="w-full px-[17%] pb-[14.5%] flex items-start justify-between text-[#27272a] font-bold"
                  style={{
                    fontFamily: '"Tajawal", "Cairo", sans-serif',
                    fontSize: 'clamp(6.5px, 1.6cqw, 18px)',
                  }}
                >
                  {/* Right Side: ختم مركز التطوير المهني */}
                  <div
                    data-testid={`certificate-stamp-label-${certIndex + 1}`}
                    className="text-center"
                  >
                    {certContent.stampLabel}
                  </div>

                  {/* Left Side: مدير المدرسة / مديرة المدرسة + الاسم */}
                  <div
                    data-testid={`certificate-principal-block-${certIndex + 1}`}
                    className="text-center space-y-1.5"
                  >
                    <div>{certContent.principalTitle}</div>
                    {certContent.principalName && (
                      <div className="font-bold text-zinc-900">
                        {certContent.principalName}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    );
  }

  const fieldHeaderTheme = {
    headerBgHex: '#EFF6FF',
    borderHex: '#BFDBFE',
    headerTextHex: '#1E3A8A',
  };

  // Compute summary metrics for Semester Final Report if applicable
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

  return (
    <article
      dir="rtl"
      data-testid="report-template-a4"
      className={`report-print-sheet bg-white text-stone-900 mx-auto border border-stone-200 rounded-xl print:border-0 print:rounded-none p-6 sm:p-10 flex flex-col justify-between ${
        isLandscape
          ? 'max-w-[297mm] min-h-[210mm]'
          : 'max-w-[210mm] min-h-[297mm]'
      }`}
    >
      <div className="space-y-6">
        {/* 1. Official Report Header: Kingdom, Ministry, Education Dept, School (without prefix labels), Centered Enlarged Logo, Section Title (without prefix), Academic Year */}
        <header
          data-testid="report-official-header"
          className="border-b-2 pb-4"
          style={{ borderColor: fieldHeaderTheme.borderHex }}
        >
          <div className="grid grid-cols-3 items-center gap-3 sm:gap-6 px-2 sm:px-6">
            {/* Right Zone: Official Kingdom & School Details — positioned near the middle of the right side while text is right-aligned */}
            <div className="flex justify-center">
              <div
                data-testid="report-header-right"
                className="text-right space-y-1 text-xs sm:text-sm leading-relaxed -translate-x-5 sm:-translate-x-10"
              >
                <p className="font-bold text-stone-950">المملكة العربية السعودية</p>
                <p className="font-semibold text-stone-800">وزارة التعليم</p>
                <p className="font-semibold text-stone-900">
                  {settings.educationDepartment || 'غير محدد'}
                </p>
                <p className="font-semibold text-stone-900">
                  {settings.schoolName || 'غير محدد'}
                </p>
              </div>
            </div>

            {/* Center Zone: Ministry of Education Official PNG Logo — centered horizontally, enlarged, preserving original aspect ratio */}
            <div className="flex items-center justify-center">
              <div
                data-testid="report-header-logo-container"
                className="w-28 sm:w-40 aspect-[48/38] overflow-hidden flex items-center justify-center mx-auto shrink-0"
              >
                <img
                  src="./moe-logo.png"
                  alt="شعار وزارة التعليم"
                  referrerPolicy="no-referrer"
                  data-testid="report-header-logo"
                  className="w-[208%] max-w-none h-auto object-contain select-none pointer-events-none"
                />
              </div>
            </div>

            {/* Left Zone: Section Title (without 'القسم:') & Academic Year — positioned near the middle of the left side */}
            <div className="flex justify-center">
              <div
                data-testid="report-header-left"
                className="text-center space-y-1.5 text-xs sm:text-sm leading-relaxed"
              >
                <p
                  className="font-bold text-sm sm:text-base"
                  style={{ color: fieldHeaderTheme.headerTextHex }}
                >
                  {section.title}
                </p>
                <p className="font-semibold text-stone-900 tabular-nums">
                  {effectiveAcademicYear}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* 2. Report Main Title — Unified with the official report visual identity */}
        <div
          data-testid="report-main-title-banner"
          className="rounded-xl border py-3.5 px-5 text-center"
          style={{
            backgroundColor: fieldHeaderTheme.headerBgHex,
            borderColor: fieldHeaderTheme.borderHex,
          }}
        >
          <h1
            className="text-xl sm:text-2xl font-extrabold font-display"
            style={{ color: fieldHeaderTheme.headerTextHex }}
          >
            {form.reportTitle || form.title}
          </h1>
        </div>

        {/* Semester Final Report Summary Metrics Bar */}
        {layout === 'semester-final-report' && (
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            {[
              {
                label: 'الفصل الدراسي',
                value: renderScalarValue(values.semesterName),
              },
              {
                label: 'العام الدراسي',
                value: effectiveAcademicYear,
              },
              {
                label: 'إجمالي البرامج المنفذة',
                value: String(executedProgramsRows.length),
              },
              {
                label: 'إجمالي المستفيدين',
                value: String(totalBeneficiaries),
              },
            ].map((metric) => (
              <div
                key={metric.label}
                className="rounded-xl overflow-hidden bg-white border flex flex-col"
                style={{ borderColor: fieldHeaderTheme.borderHex }}
              >
                <div
                  className="px-3 py-2 text-xs font-bold text-center border-b"
                  style={{
                    backgroundColor: fieldHeaderTheme.headerBgHex,
                    borderColor: fieldHeaderTheme.borderHex,
                    color: fieldHeaderTheme.headerTextHex,
                  }}
                >
                  {metric.label}
                </div>
                <div className="px-3 py-2.5 text-sm sm:text-base font-extrabold text-stone-950 text-center bg-white tabular-nums flex-1 flex items-center justify-center">
                  {metric.value}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* 3. Report Body Content (Readable fixed font scale, never auto-shrunk) */}
        <div className="space-y-5 text-sm sm:text-base leading-relaxed">
          {/* Standard Fields Grid */}
          {standardFields.length > 0 && (
            <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {standardFields.map((field) => {
                const isFull =
                  field.width === 'full' || field.type === 'textarea';
                const isLongText = field.type === 'textarea';
                const resolvedValue = resolveReportFieldValue(field, values);
                return (
                  <div
                    key={field.id}
                    data-testid={`report-field-${field.id}`}
                    className={`rounded-xl overflow-hidden bg-white border flex flex-col ${
                      isFull ? 'sm:col-span-2' : 'col-span-1'
                    }`}
                    style={{ borderColor: fieldHeaderTheme.borderHex }}
                  >
                    <div
                      data-testid={`report-field-header-${field.id}`}
                      className="px-4 py-2 text-xs sm:text-sm font-bold text-center border-b"
                      style={{
                        backgroundColor: fieldHeaderTheme.headerBgHex,
                        borderColor: fieldHeaderTheme.borderHex,
                        color: fieldHeaderTheme.headerTextHex,
                      }}
                    >
                      {field.label}
                    </div>
                    <div
                      className={`px-4 py-3 text-sm sm:text-base font-medium text-stone-900 bg-white whitespace-pre-line break-words flex-1 flex items-center ${
                        isLongText
                          ? 'text-right justify-start'
                          : 'text-center justify-center'
                      }`}
                    >
                      <span className="w-full">
                        {renderScalarValue(resolvedValue)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </section>
          )}

          {/* Repeatable Fields Lists */}
          {repeatableFields.map((field) => {
            const rawItems = Array.isArray(values[field.id])
              ? (values[field.id] as string[])
              : [];
            const populatedItems = rawItems.filter(
              (item) => typeof item === 'string' && item.trim().length > 0
            );
            return (
              <section
                key={field.id}
                data-testid={`report-field-${field.id}`}
                className="rounded-xl overflow-hidden bg-white border"
                style={{ borderColor: fieldHeaderTheme.borderHex }}
              >
                <h2
                  data-testid={`report-field-header-${field.id}`}
                  className="px-4 py-2.5 text-sm sm:text-base font-bold font-display text-center border-b"
                  style={{
                    backgroundColor: fieldHeaderTheme.headerBgHex,
                    borderColor: fieldHeaderTheme.borderHex,
                    color: fieldHeaderTheme.headerTextHex,
                  }}
                >
                  {field.label}
                </h2>
                <div className="p-4 bg-white text-right">
                  {populatedItems.length > 0 ? (
                    <ol className="list-decimal list-inside space-y-1.5 text-sm sm:text-base text-stone-800 text-right">
                      {populatedItems.map((item, idx) => (
                        <li key={idx} className="leading-relaxed break-words">
                          {item}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-sm text-stone-500 text-right">—</p>
                  )}
                </div>
              </section>
            );
          })}

          {/* Structured Tables */}
          {tableFields.map((field) => {
            const cols = field.columns ?? [];
            const rows = Array.isArray(values[field.id])
              ? (values[field.id] as TableRowData[])
              : [];
            return (
              <section
                key={field.id}
                data-testid={`report-field-${field.id}`}
                className="rounded-xl overflow-hidden bg-white border"
                style={{ borderColor: fieldHeaderTheme.borderHex }}
              >
                <h2
                  data-testid={`report-field-header-${field.id}`}
                  className="px-4 py-2.5 text-sm sm:text-base font-bold font-display text-center border-b"
                  style={{
                    backgroundColor: fieldHeaderTheme.headerBgHex,
                    borderColor: fieldHeaderTheme.borderHex,
                    color: fieldHeaderTheme.headerTextHex,
                  }}
                >
                  {field.label}
                </h2>
                <div className="overflow-x-auto bg-white">
                  <table className="w-full text-right border-collapse text-sm">
                    <thead>
                      <tr
                        className="border-b font-bold"
                        style={{
                          backgroundColor: fieldHeaderTheme.headerBgHex,
                          borderColor: fieldHeaderTheme.borderHex,
                          color: fieldHeaderTheme.headerTextHex,
                        }}
                      >
                        <th
                          className="py-2.5 px-3 w-12 text-center border-l"
                          style={{ borderColor: fieldHeaderTheme.borderHex }}
                        >
                          م
                        </th>
                        {cols.map((col) => (
                          <th
                            key={col.key}
                            className="py-2.5 px-3 text-center border-l last:border-l-0"
                            style={{ borderColor: fieldHeaderTheme.borderHex }}
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200 bg-white">
                      {rows.map((row, rIdx) => (
                        <tr key={rIdx} className="bg-white">
                          <td className="py-2.5 px-3 text-center font-semibold text-stone-700 border-l border-stone-200 tabular-nums">
                            {rIdx + 1}
                          </td>
                          {cols.map((col) => {
                            const isLongCol =
                              col.key === 'programName' ||
                              col.key === 'keyOutputs';
                            return (
                              <td
                                key={col.key}
                                className={`py-2.5 px-3 text-stone-800 border-l last:border-l-0 border-stone-200 break-words ${
                                  isLongCol ? 'text-right' : 'text-center'
                                }`}
                              >
                                {row[col.key]?.trim() || '—'}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}

          {/* Evidence Images Grid */}
          {imageFields.map((field) => {
            const imgs = Array.isArray(values[field.id])
              ? (values[field.id] as EvidenceImageItem[])
              : [];
            if (imgs.length === 0) return null;
            return (
              <section
                key={field.id}
                data-testid={`report-field-${field.id}`}
                className="rounded-xl overflow-hidden bg-white border"
                style={{ borderColor: fieldHeaderTheme.borderHex }}
              >
                <h2
                  data-testid={`report-field-header-${field.id}`}
                  className="px-4 py-2.5 text-sm sm:text-base font-bold font-display text-center border-b"
                  style={{
                    backgroundColor: fieldHeaderTheme.headerBgHex,
                    borderColor: fieldHeaderTheme.borderHex,
                    color: fieldHeaderTheme.headerTextHex,
                  }}
                >
                  {field.label}
                </h2>
                <div className="p-4 bg-white grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {imgs.map((img, idx) => (
                    <figure
                      key={img.id}
                      className="rounded-xl border border-stone-200 p-3 bg-white flex flex-col items-center"
                    >
                      <div className="h-44 w-full flex items-center justify-center overflow-hidden rounded-lg bg-white">
                        <img
                          src={img.dataUrl}
                          alt={img.caption || `شاهد ${idx + 1}`}
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                      {img.caption && (
                        <figcaption className="mt-2 text-xs sm:text-sm font-medium text-stone-700 text-center">
                          {img.caption}
                        </figcaption>
                      )}
                    </figure>
                  ))}
                </div>
              </section>
            );
          })}

          {/* Report Preparer / Executor Block at the End of the Report */}
          {footerMode === 'executor' ? (
            <section
              data-testid="report-executor-section"
              className="rounded-xl overflow-hidden bg-white border"
              style={{ borderColor: fieldHeaderTheme.borderHex }}
            >
              <div className="p-4 bg-white grid grid-cols-1 sm:grid-cols-3 gap-4 items-center text-sm">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-bold text-stone-700">معد التقرير:</span>
                  <strong className="font-bold text-stone-950">
                    {typeof values.executorName === 'string' &&
                    values.executorName.trim()
                      ? values.executorName.trim()
                      : settings.userName || 'غير محدد'}
                  </strong>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-bold text-stone-700">السجل المدني:</span>
                  <strong className="font-bold text-stone-950 tabular-nums">
                    {renderScalarValue(values.executorNationalId)}
                  </strong>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-stone-700">التوقيع:</span>
                  {typeof values.executorSignature === 'string' &&
                    values.executorSignature.trim().length > 0 && (
                      <img
                        data-testid="report-signature-image"
                        src={values.executorSignature}
                        alt="التوقيع"
                        className="h-12 max-w-[150px] object-contain"
                      />
                    )}
                </div>
              </div>
            </section>
          ) : (
            <section
              data-testid="report-executor-section"
              className="rounded-xl overflow-hidden bg-white border"
              style={{ borderColor: fieldHeaderTheme.borderHex }}
            >
              <div className="p-4 bg-white flex flex-wrap items-center justify-between gap-4 text-sm">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-bold text-stone-700">معد التقرير:</span>
                  <strong className="font-bold text-stone-950">
                    {settings.userName || 'غير محدد'}
                  </strong>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-stone-700">التوقيع:</span>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>

      {/* 4. End of Report Footer: Right: Coordinator/Teacher Name, Left: School Principal Name (No Academic Year in Footer) */}
      <footer
        data-testid="report-preparer-footer"
        className="mt-10 pt-4 border-t-2 border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm"
      >
        <div
          data-testid="report-footer-right"
          className="text-center sm:text-right font-bold text-stone-900"
        >
          <span>{roleTitle}: </span>
          <span>{settings.userName || 'غير محدد'}</span>
        </div>

        <div
          data-testid="report-footer-left"
          className="text-center sm:text-left font-bold text-stone-900"
        >
          <span>{gendered.principalTitle}: </span>
          <span>{settings.principalName || 'غير محدد'}</span>
        </div>
      </footer>
    </article>
  );
};
