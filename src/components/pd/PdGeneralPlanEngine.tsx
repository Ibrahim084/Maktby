import React, { useMemo, useState } from 'react';
import {
  FileDown,
  Plus,
  Trash2,
} from 'lucide-react';
import { SchoolSettings } from '../../types';
import {
  calculatePlanExecutedHours,
  createEmptyPlanTopicRow,
  createPlanVessel,
  PdAcademicPeriodRecord,
  PdGeneralPlanData,
  PlanExecutionStatus,
  resolvePdOfficialHeader,
} from '../../utils/pdCoordinatorEngine';
import { generatePdGeneralPlanPdfBytes } from '../../utils/pdReportPdfGenerator';

interface PdGeneralPlanEngineProps {
  period: PdAcademicPeriodRecord;
  settings: SchoolSettings;
  onUpdatePlan: (updater: (prev: PdGeneralPlanData) => PdGeneralPlanData) => void;
}

export const PdGeneralPlanEngine: React.FC<PdGeneralPlanEngineProps> = ({
  period,
  settings,
  onUpdatePlan,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const plan = period.generalPlan;
  const header = useMemo(
    () => resolvePdOfficialHeader(period, settings),
    [period, settings]
  );

  const totalExecutedHours = useMemo(
    () => calculatePlanExecutedHours(plan),
    [plan]
  );

  const handleVesselNameChange = (vesselId: string, vesselName: string) => {
    onUpdatePlan((prev) => ({
      ...prev,
      vessels: prev.vessels.map((v) =>
        v.id === vesselId ? { ...v, vesselName } : v
      ),
    }));
  };

  const handleAddVessel = () => {
    onUpdatePlan((prev) => ({
      ...prev,
      vessels: [...prev.vessels, createPlanVessel('', 5)],
    }));
  };

  const handleRemoveVessel = (vesselId: string) => {
    onUpdatePlan((prev) => {
      if (prev.vessels.length <= 1) return prev;
      return {
        ...prev,
        vessels: prev.vessels.filter((v) => v.id !== vesselId),
      };
    });
  };

  const handleAddRowToVessel = (vesselId: string) => {
    onUpdatePlan((prev) => ({
      ...prev,
      vessels: prev.vessels.map((v) =>
        v.id === vesselId
          ? { ...v, rows: [...v.rows, createEmptyPlanTopicRow()] }
          : v
      ),
    }));
  };

  const handleRemoveRow = (vesselId: string, rowId: string) => {
    onUpdatePlan((prev) => ({
      ...prev,
      vessels: prev.vessels.map((v) => {
        if (v.id !== vesselId || v.rows.length <= 1) return v;
        return {
          ...v,
          rows: v.rows.filter((r) => r.id !== rowId),
        };
      }),
    }));
  };

  const handleRowFieldChange = (
    vesselId: string,
    rowId: string,
    field:
      | 'topic'
      | 'presenterName'
      | 'specialization'
      | 'executionDate'
      | 'hoursCount'
      | 'executionLocation'
      | 'notExecutedReason',
    value: string
  ) => {
    onUpdatePlan((prev) => ({
      ...prev,
      vessels: prev.vessels.map((v) =>
        v.id === vesselId
          ? {
              ...v,
              rows: v.rows.map((r) =>
                r.id === rowId ? { ...r, [field]: value } : r
              ),
            }
          : v
      ),
    }));
  };

  const handleToggleStatus = (
    vesselId: string,
    rowId: string,
    target: Exclude<PlanExecutionStatus, 'pending'>
  ) => {
    onUpdatePlan((prev) => ({
      ...prev,
      vessels: prev.vessels.map((v) =>
        v.id === vesselId
          ? {
              ...v,
              rows: v.rows.map((r) => {
                if (r.id !== rowId) return r;
                const nextStatus: PlanExecutionStatus =
                  r.executionStatus === target ? 'pending' : target;
                return {
                  ...r,
                  executionStatus: nextStatus,
                  notExecutedReason:
                    nextStatus === 'not_executed' ? r.notExecutedReason : '',
                };
              }),
            }
          : v
      ),
    }));
  };

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      const { pdfBytes, filename } = await generatePdGeneralPlanPdfBytes(
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
    <div className="space-y-5" dir="rtl" data-testid="pd-general-plan-engine">
      {/* Form Title & Export Toolbar */}
      <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-stone-100 pb-4">
          <div className="space-y-1">
            <h2 className="text-lg font-bold font-display text-stone-900">
              الخطة العامة للتطوير المهني للمدرسة للعام الدراسي ({header.academicYear})
            </h2>
            <p className="text-xs sm:text-sm text-stone-600">
              خطة مستقلة لـ ({period.semester}) — مسميات الأوعية فارغة لإدخالها يدوياً مع صفوف غير محدودة.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleAddVessel}
              className="min-h-[40px] px-3.5 py-2 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-xs sm:text-sm font-semibold text-stone-800 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4 text-[#477B59]" aria-hidden="true" />
              <span>إضافة وعاء تطوير مهني</span>
            </button>

            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isExporting}
              className="min-h-[40px] px-4 py-2 rounded-lg bg-[#477B59] hover:bg-[#386347] disabled:opacity-60 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <FileDown className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{isExporting ? 'جاري التصدير...' : 'تصدير الخطة PDF'}</span>
            </button>
          </div>
        </div>

        {/* Official Top Strip mirroring Page 3 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs bg-stone-50 rounded-lg border border-stone-200 p-3.5">
          <div>
            <span className="text-stone-500 block">اسم المدرسة</span>
            <span className="font-bold text-stone-900">{header.schoolName}</span>
          </div>
          <div>
            <span className="text-stone-500 block">المرحلة الدراسية</span>
            <span className="font-bold text-stone-900">
              {period.schoolStages.length > 0
                ? period.schoolStages.join(' · ')
                : 'لم تحدد بعد من الشريط العلوي'}
            </span>
          </div>
          <div>
            <span className="text-stone-500 block">الفصل الدراسي</span>
            <span className="font-bold text-stone-900">{period.semester}</span>
          </div>
        </div>
      </div>

      {/* Main RTL Plan Table matching Page 3 Columns */}
      <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1280px] border-collapse text-xs">
            <thead>
              <tr className="bg-stone-100 text-stone-900 border-b border-stone-300">
                <th className="p-2.5 border-l border-stone-300 w-10 min-w-[40px] text-center font-bold">
                  م
                </th>
                <th className="p-2.5 border-l border-stone-300 w-44 min-w-[165px] text-center font-bold">
                  الوعاء
                </th>
                <th className="p-2.5 border-l border-stone-300 w-56 min-w-[205px] text-center font-bold">
                  الموضوع
                </th>
                <th className="p-2.5 border-l border-stone-300 w-44 min-w-[165px] text-center font-bold">
                  الاسم
                </th>
                <th className="p-2.5 border-l border-stone-300 w-28 min-w-[110px] text-center font-bold">
                  التخصص
                </th>
                <th className="p-2.5 border-l border-stone-300 w-32 min-w-[120px] text-center font-bold">
                  التاريخ
                </th>
                <th className="p-2.5 border-l border-stone-300 w-20 min-w-[78px] text-center font-bold">
                  عدد الساعات
                </th>
                <th className="p-2.5 border-l border-stone-300 w-36 min-w-[140px] text-center font-bold">
                  مقر التنفيذ
                </th>
                <th className="p-2.5 border-l border-stone-300 w-14 min-w-[52px] text-center font-bold">
                  نفذ
                </th>
                <th className="p-2.5 border-l border-stone-300 w-16 min-w-[62px] text-center font-bold">
                  لم ينفذ
                </th>
                <th className="p-2.5 min-w-[175px] text-center font-bold">
                  سبب عدم التنفيذ
                </th>
              </tr>
            </thead>
            <tbody>
              {plan.vessels.map((vessel, vIdx) => (
                <React.Fragment key={vessel.id}>
                  {vessel.rows.map((row, rIdx) => (
                    <tr
                      key={row.id}
                      className="border-b border-stone-200 hover:bg-stone-50/60"
                    >
                      {rIdx === 0 && (
                        <>
                          <td
                            rowSpan={vessel.rows.length + 1}
                            className="p-2 border-l border-stone-300 text-center font-bold bg-stone-50/70 align-middle tabular-nums"
                          >
                            {vIdx + 1}
                          </td>
                          <td
                            rowSpan={vessel.rows.length + 1}
                            className="p-2.5 border-l border-stone-300 bg-white align-middle space-y-2"
                          >
                            <textarea
                              rows={3}
                              aria-label={`اسم الوعاء رقم ${vIdx + 1}`}
                              value={vessel.vesselName}
                              onChange={(e) =>
                                handleVesselNameChange(vessel.id, e.target.value)
                              }
                              placeholder="اكتب اسم الوعاء هنا..."
                              className="w-full px-2.5 py-1.5 rounded-md border border-stone-300 bg-white text-xs font-semibold text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#477B59]"
                            />
                            {plan.vessels.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveVessel(vessel.id)}
                                aria-label={`حذف الوعاء رقم ${vIdx + 1}`}
                                className="w-full py-1 px-2 rounded text-[11px] font-medium text-red-600 hover:bg-red-50 inline-flex items-center justify-center gap-1 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" aria-hidden="true" />
                                <span>حذف الوعاء</span>
                              </button>
                            )}
                          </td>
                        </>
                      )}

                      {/* الموضوع مع ترقيم داخلي */}
                      <td className="p-1.5 border-l border-stone-200">
                        <div className="flex items-center gap-1.5">
                          <span className="w-5 text-center font-bold text-stone-500 tabular-nums shrink-0">
                            {rIdx + 1}
                          </span>
                          <input
                            type="text"
                            aria-label={`الموضوع ${rIdx + 1} في الوعاء ${vIdx + 1}`}
                            value={row.topic}
                            onChange={(e) =>
                              handleRowFieldChange(
                                vessel.id,
                                row.id,
                                'topic',
                                e.target.value
                              )
                            }
                            placeholder="الموضوع..."
                            className="flex-1 min-w-0 px-2 py-1.5 rounded border border-stone-200 bg-white text-xs text-stone-900 focus:outline-none focus:border-[#477B59]"
                          />
                        </div>
                      </td>

                      {/* الاسم */}
                      <td className="p-1.5 border-l border-stone-200">
                        <input
                          type="text"
                          aria-label={`الاسم للصف ${rIdx + 1} بالوعاء ${vIdx + 1}`}
                          value={row.presenterName}
                          onChange={(e) =>
                            handleRowFieldChange(
                              vessel.id,
                              row.id,
                              'presenterName',
                              e.target.value
                            )
                          }
                          className="w-full px-2 py-1.5 rounded border border-stone-200 bg-white text-xs text-stone-900 focus:outline-none focus:border-[#477B59]"
                        />
                      </td>

                      {/* التخصص */}
                      <td className="p-1.5 border-l border-stone-200">
                        <input
                          type="text"
                          aria-label={`التخصص للصف ${rIdx + 1} بالوعاء ${vIdx + 1}`}
                          value={row.specialization}
                          onChange={(e) =>
                            handleRowFieldChange(
                              vessel.id,
                              row.id,
                              'specialization',
                              e.target.value
                            )
                          }
                          className="w-full px-2 py-1.5 rounded border border-stone-200 bg-white text-xs text-stone-900 focus:outline-none focus:border-[#477B59]"
                        />
                      </td>

                      {/* التاريخ */}
                      <td className="p-1.5 border-l border-stone-200">
                        <input
                          type="text"
                          aria-label={`التاريخ للصف ${rIdx + 1} بالوعاء ${vIdx + 1}`}
                          value={row.executionDate}
                          onChange={(e) =>
                            handleRowFieldChange(
                              vessel.id,
                              row.id,
                              'executionDate',
                              e.target.value
                            )
                          }
                          placeholder="مثال: 1448/4/15"
                          className="w-full px-2 py-1.5 rounded border border-stone-200 bg-white text-xs text-stone-900 tabular-nums focus:outline-none focus:border-[#477B59]"
                        />
                      </td>

                      {/* عدد الساعات */}
                      <td className="p-1.5 border-l border-stone-200">
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          aria-label={`عدد الساعات للصف ${rIdx + 1} بالوعاء ${vIdx + 1}`}
                          value={row.hoursCount}
                          onChange={(e) =>
                            handleRowFieldChange(
                              vessel.id,
                              row.id,
                              'hoursCount',
                              e.target.value
                            )
                          }
                          className="w-full px-2 py-1.5 rounded border border-stone-200 bg-white text-xs text-center text-stone-900 tabular-nums focus:outline-none focus:border-[#477B59]"
                        />
                      </td>

                      {/* مقر التنفيذ */}
                      <td className="p-1.5 border-l border-stone-200">
                        <input
                          type="text"
                          aria-label={`مقر التنفيذ للصف ${rIdx + 1} بالوعاء ${vIdx + 1}`}
                          value={row.executionLocation}
                          onChange={(e) =>
                            handleRowFieldChange(
                              vessel.id,
                              row.id,
                              'executionLocation',
                              e.target.value
                            )
                          }
                          className="w-full px-2 py-1.5 rounded border border-stone-200 bg-white text-xs text-stone-900 focus:outline-none focus:border-[#477B59]"
                        />
                      </td>

                      {/* نفذ */}
                      <td className="p-1.5 border-l border-stone-200 text-center">
                        <input
                          type="checkbox"
                          aria-label={`نفذ للصف ${rIdx + 1} بالوعاء ${vIdx + 1}`}
                          checked={row.executionStatus === 'executed'}
                          onChange={() =>
                            handleToggleStatus(vessel.id, row.id, 'executed')
                          }
                          className="w-4 h-4 accent-[#477B59] cursor-pointer"
                        />
                      </td>

                      {/* لم ينفذ */}
                      <td className="p-1.5 border-l border-stone-200 text-center">
                        <input
                          type="checkbox"
                          aria-label={`لم ينفذ للصف ${rIdx + 1} بالوعاء ${vIdx + 1}`}
                          checked={row.executionStatus === 'not_executed'}
                          onChange={() =>
                            handleToggleStatus(vessel.id, row.id, 'not_executed')
                          }
                          className="w-4 h-4 accent-red-600 cursor-pointer"
                        />
                      </td>

                      {/* سبب عدم التنفيذ + حذف صف */}
                      <td className="p-1.5">
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            aria-label={`سبب عدم التنفيذ للصف ${rIdx + 1} بالوعاء ${vIdx + 1}`}
                            value={row.notExecutedReason}
                            onChange={(e) =>
                              handleRowFieldChange(
                                vessel.id,
                                row.id,
                                'notExecutedReason',
                                e.target.value
                              )
                            }
                            placeholder={
                              row.executionStatus === 'not_executed'
                                ? 'اذكر السبب...'
                                : ''
                            }
                            className="flex-1 min-w-0 px-2 py-1.5 rounded border border-stone-200 bg-white text-xs text-stone-900 focus:outline-none focus:border-[#477B59]"
                          />
                          {vessel.rows.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveRow(vessel.id, row.id)}
                              aria-label={`حذف الصف ${rIdx + 1} من الوعاء ${vIdx + 1}`}
                              className="p-1.5 rounded text-stone-400 hover:text-red-600 hover:bg-red-50 cursor-pointer shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}

                  {/* Vessel Add Row Bar */}
                  <tr className="bg-stone-50/50 border-b-2 border-stone-300">
                    <td colSpan={9} className="p-2">
                      <button
                        type="button"
                        onClick={() => handleAddRowToVessel(vessel.id)}
                        className="px-3 py-1.5 rounded-md border border-stone-300 bg-white hover:bg-stone-100 text-xs font-semibold text-[#477B59] inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>إضافة صف موضوع جديد للوعاء ({vIdx + 1})</span>
                      </button>
                    </td>
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-stone-100 font-bold text-stone-900 border-t-2 border-stone-400">
                <td colSpan={6} className="p-3 border-l border-stone-300 text-center text-sm">
                  مجموع الساعات المنفذة
                </td>
                <td
                  data-testid="pd-plan-executed-hours-total"
                  className="p-3 border-l border-stone-300 text-center text-base text-[#477B59] tabular-nums"
                >
                  {totalExecutedHours}
                </td>
                <td colSpan={4} className="p-3 text-xs text-stone-500">
                  يُحتسب تلقائياً من الموضوعات المؤشر عليها (نفذ)
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Signoff Inputs matching Page 3 (borderless signature names) */}
      <div className="rounded-xl border border-stone-200 bg-white p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-center">
          <label className="flex flex-col items-center space-y-1 text-xs font-semibold text-stone-700">
            <span>{header.coordinatorTitle}</span>
            <input
              type="text"
              value={plan.coordinatorAuthName}
              onChange={(e) =>
                onUpdatePlan((prev) => ({
                  ...prev,
                  coordinatorAuthName: e.target.value,
                }))
              }
              placeholder={header.coordinatorName}
              className="w-full max-w-xs min-h-[34px] px-2 py-1 rounded-none border-0 bg-transparent text-center text-sm font-bold text-stone-900 placeholder:text-stone-700 placeholder:font-bold focus:outline-none focus:bg-stone-50"
            />
            <span className="text-[11px] font-medium text-stone-500">
              التوقيع: ..................
            </span>
          </label>
          <label className="flex flex-col items-center space-y-1 text-xs font-semibold text-stone-700">
            <span>{header.principalTitle}</span>
            <input
              type="text"
              value={plan.principalAuthName}
              onChange={(e) =>
                onUpdatePlan((prev) => ({
                  ...prev,
                  principalAuthName: e.target.value,
                }))
              }
              placeholder={header.principalName}
              className="w-full max-w-xs min-h-[34px] px-2 py-1 rounded-none border-0 bg-transparent text-center text-sm font-bold text-stone-900 placeholder:text-stone-700 placeholder:font-bold focus:outline-none focus:bg-stone-50"
            />
            <span className="text-[11px] font-medium text-stone-500">
              التوقيع: ..................
            </span>
          </label>
        </div>
      </div>
    </div>
  );
};
