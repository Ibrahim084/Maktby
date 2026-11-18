import React, { useEffect, useMemo, useState } from 'react';
import { FileDown, Plus, Printer, Trash2 } from 'lucide-react';
import { SchoolSettings } from '../../types';
import {
  createEvaluationFromExecutedProgram,
  createProgramEvaluationRecord,
  getPdEvaluationItems,
  getPdGenderedTerms,
  PD_EVALUATION_OPTIONS,
  PdAcademicPeriodRecord,
  PdEvaluationRating,
  PdProgramEvaluationRecord,
} from '../../utils/pdCoordinatorEngine';
import { generatePdEvaluationPdfBytes } from '../../utils/pdReportPdfGenerator';

interface PdEvaluationEngineProps {
  period: PdAcademicPeriodRecord;
  settings: SchoolSettings;
  onUpdateEvaluations: (
    updater: (prev: PdProgramEvaluationRecord[]) => PdProgramEvaluationRecord[]
  ) => void;
}

export const PdEvaluationEngine: React.FC<PdEvaluationEngineProps> = ({
  period,
  settings,
  onUpdateEvaluations,
}) => {
  const evaluations = period.evaluations;
  const [selectedId, setSelectedId] = useState<string>(
    () => evaluations[0]?.id || ''
  );
  const [selectedSourceProgramId, setSelectedSourceProgramId] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const pdTerms = useMemo(
    () => getPdGenderedTerms(settings.gender),
    [settings.gender]
  );
  const evalItems = useMemo(
    () => getPdEvaluationItems(settings.gender),
    [settings.gender]
  );

  const recordedPrograms = period.executionReport.programs.filter((p) =>
    p.programName.trim()
  );

  useEffect(() => {
    if (evaluations.length === 0) {
      setSelectedId('');
      return;
    }
    if (!evaluations.some((e) => e.id === selectedId)) {
      setSelectedId(evaluations[0].id);
    }
  }, [evaluations, selectedId]);

  const activeEval =
    evaluations.find((e) => e.id === selectedId) || evaluations[0] || null;

  const handleCreateEvaluation = (fromProgramId?: string) => {
    const matchedProgram = recordedPrograms.find((p) => p.id === fromProgramId);
    const created = matchedProgram
      ? createEvaluationFromExecutedProgram(matchedProgram)
      : createProgramEvaluationRecord();
    onUpdateEvaluations((prev) => [...prev, created]);
    setSelectedId(created.id);
  };

  const handleDeleteEvaluation = (id: string) => {
    onUpdateEvaluations((prev) => prev.filter((e) => e.id !== id));
  };

  const handleMetaChange = (
    field:
      | 'programName'
      | 'targetAudience'
      | 'targetCount'
      | 'executionDate'
      | 'executionLocation'
      | 'trainerName'
      | 'traineeLabel'
      | 'positives'
      | 'challenges',
    value: string
  ) => {
    if (!activeEval) return;
    onUpdateEvaluations((prev) =>
      prev.map((item) =>
        item.id === activeEval.id
          ? { ...item, [field]: value, updatedAt: new Date().toISOString() }
          : item
      )
    );
  };

  const handleRatingChange = (itemId: string, rating: PdEvaluationRating) => {
    if (!activeEval) return;
    onUpdateEvaluations((prev) =>
      prev.map((ev) => {
        if (ev.id !== activeEval.id) return ev;
        return {
          ...ev,
          updatedAt: new Date().toISOString(),
          responses: ev.responses.map((r) =>
            r.itemId === itemId
              ? {
                  ...r,
                  rating: r.rating === rating ? '' : rating,
                  disagreeReason:
                    rating === 'disagree' && r.rating !== 'disagree'
                      ? r.disagreeReason
                      : '',
                }
              : r
          ),
        };
      })
    );
  };

  const handleDisagreeReasonChange = (itemId: string, reason: string) => {
    if (!activeEval) return;
    onUpdateEvaluations((prev) =>
      prev.map((ev) => {
        if (ev.id !== activeEval.id) return ev;
        return {
          ...ev,
          updatedAt: new Date().toISOString(),
          responses: ev.responses.map((r) =>
            r.itemId === itemId ? { ...r, disagreeReason: reason } : r
          ),
        };
      })
    );
  };

  const handleExportPdf = async (mode: 'current' | 'blank' | 'all') => {
    setIsExporting(true);
    try {
      const targetList =
        mode === 'current' && activeEval
          ? [activeEval]
          : mode === 'all'
          ? evaluations
          : activeEval
          ? [activeEval]
          : [];
      const { pdfBytes, filename } = await generatePdEvaluationPdfBytes(
        targetList,
        period,
        settings,
        mode === 'blank'
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
    <div className="space-y-5" dir="rtl" data-testid="pd-evaluation-engine">
      {/* Header & Trainee Submission Controls */}
      <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-stone-100 pb-4">
          <div className="space-y-1">
            <h2 className="text-lg font-bold font-display text-stone-900">
              نموذج تقييم برنامج تطوير مهني (مطابق للنموذج الورقي)
            </h2>
            <p className="text-xs sm:text-sm text-stone-600">
              {pdTerms.evaluationSubtitle}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void handleExportPdf('blank')}
              disabled={isExporting}
              className="min-h-[40px] px-3.5 py-2 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-xs font-semibold text-stone-800 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-4 h-4 text-[#7C1D34]" aria-hidden="true" />
              <span>طباعة نموذج فارغ PDF</span>
            </button>

            {activeEval && (
              <button
                type="button"
                onClick={() => void handleExportPdf('current')}
                disabled={isExporting}
                className="min-h-[40px] px-4 py-2 rounded-lg bg-[#7C1D34] hover:bg-[#631629] disabled:opacity-60 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <FileDown className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>تصدير هذا التقييم PDF</span>
              </button>
            )}

            {evaluations.length > 1 && (
              <button
                type="button"
                onClick={() => void handleExportPdf('all')}
                disabled={isExporting}
                className="min-h-[40px] px-3.5 py-2 rounded-lg border border-[#7C1D34] text-[#7C1D34] hover:bg-[#FAF1F3] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <FileDown className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>تصدير الكل ({evaluations.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Create new evaluation (linked from 02 or manual) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-stone-50 rounded-lg border border-stone-200 p-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="pd-eval-source-program" className="text-xs font-bold text-stone-700">
              استيراد بيانات برنامج منفذ:
            </label>
            <select
              id="pd-eval-source-program"
              value={selectedSourceProgramId}
              onChange={(e) => setSelectedSourceProgramId(e.target.value)}
              className="min-h-[38px] px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-xs text-stone-900 focus:outline-none focus:border-[#7C1D34]"
            >
              <option value="">إدخال يدوي لبيانات البرنامج</option>
              {recordedPrograms.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.programName}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() =>
                handleCreateEvaluation(selectedSourceProgramId || undefined)
              }
              className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[#7C1D34] hover:bg-[#631629] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{pdTerms.createEvaluationForTraineeLabel}</span>
            </button>
          </div>

          <span className="text-xs font-semibold text-stone-600 tabular-nums">
            عدد استمارات التقييم المحفوظة: {evaluations.length}
          </span>
        </div>

        {/* Saved Independent Trainee Submissions Switcher */}
        {evaluations.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {evaluations.map((ev, idx) => {
              const isCurrent = ev.id === activeEval?.id;
              const label =
                ev.traineeLabel.trim() ||
                `${ev.programName.trim() || 'برنامج'} — ${pdTerms.traineeSingular} ${idx + 1}`;
              return (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => setSelectedId(ev.id)}
                  aria-pressed={isCurrent}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    isCurrent
                      ? 'bg-[#7C1D34] text-white'
                      : 'bg-white border border-stone-300 text-stone-700 hover:border-[#7C1D34]'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Active Evaluation Sheet (Exact Match to PDF Page 5) */}
      {!activeEval ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-white p-10 text-center space-y-4">
          <p className="text-sm font-semibold text-stone-700">
            لا توجد استمارات تقييم مسجلة في هذا الفصل الدراسي بعد.
          </p>
          <button
            type="button"
            onClick={() =>
              handleCreateEvaluation(selectedSourceProgramId || undefined)
            }
            className="min-h-[42px] px-5 py-2 rounded-lg bg-[#7C1D34] hover:bg-[#631629] text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>بدء أول نموذج تقييم برنامج</span>
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-5">
          {/* Administrative Trainee Identifier + Delete */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-3">
            <label className="flex flex-wrap items-center gap-2 text-xs font-semibold text-stone-700">
              <span>{pdTerms.evaluationTraineeFieldLabel}</span>
              <input
                type="text"
                value={activeEval.traineeLabel}
                onChange={(e) => handleMetaChange('traineeLabel', e.target.value)}
                placeholder={pdTerms.evaluationTraineePlaceholder}
                className="w-56 min-h-[36px] px-2.5 py-1 rounded border border-stone-300 bg-white text-xs text-stone-900"
              />
            </label>

            <button
              type="button"
              onClick={() => handleDeleteEvaluation(activeEval.id)}
              className="px-3 py-1.5 rounded-md text-xs font-semibold text-red-600 hover:bg-red-50 inline-flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>حذف هذه الاستمارة</span>
            </button>
          </div>

          {/* Header 6 Fields Matching Page 5 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border border-stone-300 rounded-lg p-3.5 bg-stone-50/40">
            <label className="space-y-1 text-xs font-bold text-stone-800">
              <span>اسم البرنامج</span>
              <input
                type="text"
                value={activeEval.programName}
                onChange={(e) => handleMetaChange('programName', e.target.value)}
                className="w-full min-h-[38px] px-2.5 py-1.5 rounded border border-stone-300 bg-white text-xs font-normal text-stone-900"
              />
            </label>
            <label className="space-y-1 text-xs font-bold text-stone-800">
              <span>{pdTerms.targetAudienceLabel}</span>
              <input
                type="text"
                value={activeEval.targetAudience}
                onChange={(e) =>
                  handleMetaChange('targetAudience', e.target.value)
                }
                className="w-full min-h-[38px] px-2.5 py-1.5 rounded border border-stone-300 bg-white text-xs font-normal text-stone-900"
              />
            </label>
            <label className="space-y-1 text-xs font-bold text-stone-800">
              <span>{pdTerms.targetCountLabel}</span>
              <input
                type="text"
                value={activeEval.targetCount}
                onChange={(e) => handleMetaChange('targetCount', e.target.value)}
                className="w-full min-h-[38px] px-2.5 py-1.5 rounded border border-stone-300 bg-white text-xs font-normal text-stone-900 tabular-nums"
              />
            </label>
            <label className="space-y-1 text-xs font-bold text-stone-800">
              <span>تاريخ التنفيذ</span>
              <input
                type="text"
                value={activeEval.executionDate}
                onChange={(e) =>
                  handleMetaChange('executionDate', e.target.value)
                }
                className="w-full min-h-[38px] px-2.5 py-1.5 rounded border border-stone-300 bg-white text-xs font-normal text-stone-900 tabular-nums"
              />
            </label>
            <label className="space-y-1 text-xs font-bold text-stone-800">
              <span>مكان التنفيذ</span>
              <input
                type="text"
                value={activeEval.executionLocation}
                onChange={(e) =>
                  handleMetaChange('executionLocation', e.target.value)
                }
                className="w-full min-h-[38px] px-2.5 py-1.5 rounded border border-stone-300 bg-white text-xs font-normal text-stone-900"
              />
            </label>
            <label className="space-y-1 text-xs font-bold text-stone-800">
              <span>{pdTerms.trainerNameLabel}</span>
              <input
                type="text"
                value={activeEval.trainerName}
                onChange={(e) => handleMetaChange('trainerName', e.target.value)}
                className="w-full min-h-[38px] px-2.5 py-1.5 rounded border border-stone-300 bg-white text-xs font-normal text-stone-900"
              />
            </label>
          </div>

          {/* 15 Literal Evaluation Items Matrix */}
          <div className="overflow-x-auto border border-stone-300 rounded-lg">
            <table className="w-full min-w-[820px] border-collapse text-xs">
              <thead>
                <tr className="bg-stone-100 text-stone-900 border-b border-stone-300">
                  <th rowSpan={2} className="p-2.5 border-l border-stone-300 w-10 text-center font-bold">
                    م
                  </th>
                  <th rowSpan={2} className="p-2.5 border-l border-stone-300 text-center font-bold">
                    العنصر
                  </th>
                  <th colSpan={3} className="p-2 border-l border-b border-stone-300 text-center font-bold">
                    أوافق بدرجة
                  </th>
                  <th rowSpan={2} className="p-2.5 border-l border-stone-300 w-20 text-center font-bold">
                    لا أوافق
                  </th>
                  <th rowSpan={2} className="p-2.5 w-60 text-center font-bold">
                    سبب اختيار عدم الموافقة
                  </th>
                </tr>
                <tr className="bg-stone-50 text-stone-900 border-b border-stone-300">
                  <th className="p-2 border-l border-stone-300 w-20 text-center font-bold">
                    عالية
                  </th>
                  <th className="p-2 border-l border-stone-300 w-20 text-center font-bold">
                    متوسطة
                  </th>
                  <th className="p-2 border-l border-stone-300 w-20 text-center font-bold">
                    منخفضة
                  </th>
                </tr>
              </thead>
              <tbody>
                {evalItems.map((item) => {
                  const answer = activeEval.responses.find(
                    (r) => r.itemId === item.id
                  );
                  return (
                    <tr
                      key={item.id}
                      className="border-b border-stone-200 hover:bg-stone-50/50"
                    >
                      <td className="p-2 border-l border-stone-200 text-center font-bold bg-stone-50 tabular-nums">
                        {item.index}
                      </td>
                      <td className="p-2.5 border-l border-stone-200 font-semibold text-stone-900">
                        {item.label}
                      </td>

                      {PD_EVALUATION_OPTIONS.map((opt) => (
                        <td
                          key={opt.value}
                          className="p-2 border-l border-stone-200 text-center"
                        >
                          <input
                            type="radio"
                            name={`eval_${activeEval.id}_${item.id}`}
                            aria-label={`${item.label} — ${opt.fullLabel}`}
                            checked={answer?.rating === opt.value}
                            onChange={() =>
                              handleRatingChange(item.id, opt.value)
                            }
                            onClick={() => {
                              if (answer?.rating === opt.value) {
                                handleRatingChange(item.id, '');
                              }
                            }}
                            className="w-4 h-4 accent-[#7C1D34] cursor-pointer"
                          />
                        </td>
                      ))}

                      <td className="p-1.5">
                        <input
                          type="text"
                          aria-label={`سبب عدم الموافقة للبند ${item.index}`}
                          value={answer?.disagreeReason || ''}
                          onChange={(e) =>
                            handleDisagreeReasonChange(item.id, e.target.value)
                          }
                          placeholder={
                            answer?.rating === 'disagree'
                              ? 'اذكر السبب...'
                              : ''
                          }
                          className="w-full px-2 py-1.5 rounded border border-stone-200 bg-white text-xs text-stone-900 focus:outline-none focus:border-[#7C1D34]"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* أبرز الإيجابيات & أبرز التحديات */}
          <div className="space-y-4">
            <label className="block space-y-1.5 text-xs font-bold text-stone-800">
              <span>أبرز الإيجابيات</span>
              <textarea
                rows={4}
                value={activeEval.positives}
                onChange={(e) => handleMetaChange('positives', e.target.value)}
                className="w-full min-h-[108px] px-3 py-2.5 rounded-lg border border-stone-300 bg-white text-sm font-normal text-stone-900 focus:outline-none focus:border-[#7C1D34]"
              />
            </label>
            <label className="block space-y-1.5 text-xs font-bold text-stone-800">
              <span>أبرز التحديات</span>
              <textarea
                rows={4}
                value={activeEval.challenges}
                onChange={(e) => handleMetaChange('challenges', e.target.value)}
                className="w-full min-h-[108px] px-3 py-2.5 rounded-lg border border-stone-300 bg-white text-sm font-normal text-stone-900 focus:outline-none focus:border-[#7C1D34]"
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
};
