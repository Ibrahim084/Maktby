import React, { useMemo, useState } from 'react';
import { FileDown, Plus, Trash2 } from 'lucide-react';
import { SchoolSettings } from '../../types';
import {
  createEntityId,
  deriveQuarterlyHoursReport,
  getPdGenderedTerms,
  PdAcademicPeriodRecord,
  PdQuarterlyHoursConfig,
  resolvePdOfficialHeader,
} from '../../utils/pdCoordinatorEngine';
import { generatePdQuarterlyHoursReportPdfBytes } from '../../utils/pdReportPdfGenerator';

interface PdQuarterlyHoursReportEngineProps {
  period: PdAcademicPeriodRecord;
  settings: SchoolSettings;
  onUpdateQuarterlyConfig: (
    updater: (prev: PdQuarterlyHoursConfig) => PdQuarterlyHoursConfig
  ) => void;
}

export const PdQuarterlyHoursReportEngine: React.FC<
  PdQuarterlyHoursReportEngineProps
> = ({ period, settings, onUpdateQuarterlyConfig }) => {
  const [isExporting, setIsExporting] = useState(false);

  const header = useMemo(
    () => resolvePdOfficialHeader(period, settings),
    [period, settings]
  );
  const pdTerms = useMemo(
    () => getPdGenderedTerms(settings.gender),
    [settings.gender]
  );

  const derived = useMemo(
    () => deriveQuarterlyHoursReport(period, settings.gender),
    [period, settings.gender]
  );

  const handleAddManualExtraBeneficiary = () => {
    onUpdateQuarterlyConfig((prev) => ({
      ...prev,
      manualExtraBeneficiaries: [
        ...prev.manualExtraBeneficiaries,
        {
          id: createEntityId('extra_ben'),
          name: '',
          nationalId: '',
          hoursCount: '',
        },
      ],
    }));
  };

  const handleUpdateManualExtra = (
    id: string,
    field: 'name' | 'nationalId' | 'hoursCount',
    value: string
  ) => {
    onUpdateQuarterlyConfig((prev) => ({
      ...prev,
      manualExtraBeneficiaries: prev.manualExtraBeneficiaries.map((m) =>
        m.id === id ? { ...m, [field]: value } : m
      ),
    }));
  };

  const handleRemoveManualExtra = (id: string) => {
    onUpdateQuarterlyConfig((prev) => ({
      ...prev,
      manualExtraBeneficiaries: prev.manualExtraBeneficiaries.filter(
        (m) => m.id !== id
      ),
    }));
  };

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      const { pdfBytes, filename } = await generatePdQuarterlyHoursReportPdfBytes(
        period,
        settings
      );
      const blob = new Blob([new Uint8Array(pdfBytes)], {
        type: 'application/pdf',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      className="space-y-5"
      dir="rtl"
      data-testid="pd-quarterly-hours-report-engine"
    >
      {/* Top Banner & Export Action */}
      <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-stone-100 pb-4">
          <div className="space-y-1">
            <h2 className="text-lg font-bold font-display text-stone-900">
              تقرير فصلي بعدد ساعات التطوير المهني المتحقق {pdTerms.schoolStaffDative} خلال العام الدراسي ({header.academicYear})
            </h2>
            <p className="text-xs sm:text-sm text-stone-600">
              {pdTerms.quarterlyHelperText}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void handleExportPdf()}
            disabled={isExporting}
            className="min-h-[40px] px-4 py-2 rounded-lg bg-[#7C1D34] hover:bg-[#631629] disabled:opacity-60 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <FileDown className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{isExporting ? 'جاري التصدير...' : 'تصدير التقرير الفصلي PDF'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs bg-stone-50 rounded-lg border border-stone-200 p-3.5">
          <div>
            <span className="text-stone-500 block">اسم المدرسة</span>
            <span className="font-bold text-stone-900">{header.schoolName}</span>
          </div>
          <div>
            <span className="text-stone-500 block">المرحلة</span>
            <span className="font-bold text-stone-900">
              {period.schoolStages.length > 0
                ? period.schoolStages.join(' · ')
                : 'لم تحدد بعد'}
            </span>
          </div>
          <div>
            <span className="text-stone-500 block">الفصل الدراسي</span>
            <span className="font-bold text-stone-900">{period.semester}</span>
          </div>
        </div>
      </div>

      {/* Table 1: نوع وعاء التطوير المهني */}
      <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
        <div className="p-4 border-b border-stone-200 bg-stone-50/70">
          <h3 className="text-sm font-bold font-display text-stone-900">
            أوعية التطوير المهني المنفذة ({derived.vesselRows.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-xs">
            <thead>
              <tr className="bg-stone-100 text-stone-900 border-b border-stone-300">
                <th className="p-2.5 border-l border-stone-300 w-12 text-center font-bold">
                  م
                </th>
                <th className="p-2.5 border-l border-stone-300 text-center font-bold">
                  نوع وعاء التطوير المهني
                </th>
                <th className="p-2.5 border-l border-stone-300 w-40 text-center font-bold">
                  تاريخ التنفيذ
                </th>
                <th className="p-2.5 border-l border-stone-300 w-36 text-center font-bold">
                  {pdTerms.beneficiariesCountLabel}
                </th>
                <th className="p-2.5 w-32 text-center font-bold">
                  عدد الساعات
                </th>
              </tr>
            </thead>
            <tbody>
              {derived.vesselRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-stone-500">
                    لم تُسجل برامج منفذة في «02 تقرير تنفيذ البرامج» أو «01 الخطة العامة» لهذا الفصل بعد.
                  </td>
                </tr>
              ) : (
                derived.vesselRows.map((row, idx) => (
                  <tr
                    key={row.id}
                    className="border-b border-stone-200 hover:bg-stone-50/60"
                  >
                    <td className="p-2.5 border-l border-stone-200 text-center font-bold bg-stone-50 tabular-nums">
                      {idx + 1}
                    </td>
                    <td className="p-2.5 border-l border-stone-200 font-semibold text-stone-900">
                      {row.programTitle &&
                      row.vesselTypeLabel !== row.programTitle
                        ? `${row.vesselTypeLabel} — ${row.programTitle}`
                        : row.vesselTypeLabel}
                    </td>
                    <td className="p-2.5 border-l border-stone-200 text-center tabular-nums">
                      {row.executionDate || '—'}
                    </td>
                    <td className="p-2.5 border-l border-stone-200 text-center tabular-nums">
                      {row.beneficiariesCount > 0 ? row.beneficiariesCount : '—'}
                    </td>
                    <td className="p-2.5 text-center font-bold text-[#7C1D34] tabular-nums">
                      {row.hoursCount}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Table 2: المستفيدين (10-digit ID + total hours + grand sum) */}
      <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
        <div className="p-4 border-b border-stone-200 bg-stone-50/70 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold font-display text-stone-900">
              {pdTerms.beneficiariesTitle} ({derived.beneficiaryRows.length})
            </h3>
            <p className="text-xs text-stone-500">
              {pdTerms.quarterlyBeneficiariesHint}
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddManualExtraBeneficiary}
            className="min-h-[36px] px-3 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-xs font-semibold text-[#7C1D34] inline-flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{pdTerms.addExtraBeneficiaryLabel}</span>
          </button>
        </div>

        {/* Manual extra rows quick editor when present */}
        {period.quarterlyConfig.manualExtraBeneficiaries.length > 0 && (
          <div className="p-3.5 bg-stone-50/60 border-b border-stone-200 space-y-2">
            <p className="text-xs font-bold text-stone-700">
              {pdTerms.beneficiariesExtraHeading}
            </p>
            {period.quarterlyConfig.manualExtraBeneficiaries.map((m, idx) => (
              <div key={m.id} className="grid grid-cols-12 gap-2 items-center">
                <input
                  type="text"
                  placeholder="الاسم الكامل"
                  aria-label={`اسم ${pdTerms.beneficiaryDefinite} الإضافي ${idx + 1}`}
                  value={m.name}
                  onChange={(e) =>
                    handleUpdateManualExtra(m.id, 'name', e.target.value)
                  }
                  className="col-span-5 px-2.5 py-1.5 rounded border border-stone-300 bg-white text-xs"
                />
                <input
                  type="text"
                  placeholder="الهوية الوطنية"
                  aria-label={`الهوية الوطنية ${settings.gender === 'female' ? 'للمستفيدة الإضافية' : 'للمستفيد الإضافي'} ${idx + 1}`}
                  value={m.nationalId}
                  onChange={(e) =>
                    handleUpdateManualExtra(m.id, 'nationalId', e.target.value)
                  }
                  className="col-span-4 px-2.5 py-1.5 rounded border border-stone-300 bg-white text-xs tabular-nums"
                />
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="الساعات"
                  aria-label={`ساعات ${pdTerms.beneficiaryDefinite} الإضافي ${idx + 1}`}
                  value={m.hoursCount}
                  onChange={(e) =>
                    handleUpdateManualExtra(m.id, 'hoursCount', e.target.value)
                  }
                  className="col-span-2 px-2.5 py-1.5 rounded border border-stone-300 bg-white text-xs text-center tabular-nums"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveManualExtra(m.id)}
                  aria-label={`حذف ${pdTerms.beneficiaryDefinite} الإضافي ${idx + 1}`}
                  className="col-span-1 p-1.5 text-stone-400 hover:text-red-600 flex justify-center cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-xs">
            <thead>
              <tr className="bg-stone-100 text-stone-900 border-b border-stone-300">
                <th className="p-2.5 border-l border-stone-300 w-12 text-center font-bold">
                  م
                </th>
                <th className="p-2.5 border-l border-stone-300 text-center font-bold">
                  الاسم
                </th>
                <th className="p-2.5 border-l border-stone-300 w-56 text-center font-bold">
                  الهوية الوطنية
                </th>
                <th className="p-2.5 w-36 text-center font-bold">
                  مجموع الساعات
                </th>
              </tr>
            </thead>
            <tbody>
              {derived.beneficiaryRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-stone-500">
                    {pdTerms.quarterlyEmptyBeneficiaries}
                  </td>
                </tr>
              ) : (
                derived.beneficiaryRows.map((ben, idx) => (
                  <tr
                    key={ben.id}
                    className="border-b border-stone-200 hover:bg-stone-50/60"
                  >
                    <td className="p-2.5 border-l border-stone-200 text-center font-bold bg-stone-50 tabular-nums">
                      {idx + 1}
                    </td>
                    <td className="p-2.5 border-l border-stone-200 font-semibold text-stone-900">
                      {ben.name}
                    </td>
                    <td className="p-2.5 border-l border-stone-200 text-center font-mono tracking-wider tabular-nums">
                      {ben.nationalId || '—'}
                    </td>
                    <td className="p-2.5 text-center font-bold text-[#7C1D34] tabular-nums">
                      {ben.totalHours}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="bg-stone-100 font-bold text-stone-900 border-t-2 border-stone-400">
                <td colSpan={3} className="p-3 border-l border-stone-300 text-center text-sm">
                  {`مجموع ساعات التطوير المهني ${pdTerms.schoolStaffDative}`}
                </td>
                <td
                  data-testid="pd-quarterly-total-hours"
                  className="p-3 text-center text-base text-[#7C1D34] tabular-nums"
                >
                  {derived.totalSchoolHours}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
