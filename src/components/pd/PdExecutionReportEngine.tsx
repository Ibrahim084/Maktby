import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  FileDown,
  ImagePlus,
  Plus,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { SchoolSettings } from '../../types';
import {
  createEmptyExecutedProgramEntry,
  createEmptyTrainerEntry,
  createEntityId,
  getDefaultPdAttachmentRepository,
  getPdGenderedTerms,
  parseBatchBeneficiaryLines,
  PdAcademicPeriodRecord,
  PdEvidencePhotoRef,
  PdExecutionReportData,
  resolvePdOfficialHeader,
} from '../../utils/pdCoordinatorEngine';
import { generatePdExecutionReportPdfBytes } from '../../utils/pdReportPdfGenerator';

interface PdExecutionReportEngineProps {
  period: PdAcademicPeriodRecord;
  settings: SchoolSettings;
  onUpdateExecution: (
    updater: (prev: PdExecutionReportData) => PdExecutionReportData
  ) => void;
}

export const PdExecutionReportEngine: React.FC<PdExecutionReportEngineProps> = ({
  period,
  settings,
  onUpdateExecution,
}) => {
  const [expandedProgramId, setExpandedProgramId] = useState<string | null>(null);
  const [batchTextByProg, setBatchTextByProg] = useState<Record<string, string>>({});
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<Record<string, string>>({});
  const [isExporting, setIsExporting] = useState(false);

  const er = period.executionReport;
  const header = useMemo(
    () => resolvePdOfficialHeader(period, settings),
    [period, settings]
  );
  const pdTerms = useMemo(
    () => getPdGenderedTerms(settings.gender),
    [settings.gender]
  );

  // Load previews for evidence photos stored in IndexedDB
  useEffect(() => {
    let active = true;
    const createdUrls: string[] = [];

    const loadAllPreviews = async () => {
      const repo = getDefaultPdAttachmentRepository();
      const map: Record<string, string> = {};
      for (const prog of er.programs) {
        for (const ph of prog.evidencePhotos) {
          const att = await repo.getAttachment(ph.blobKey);
          if (att && att.bytes.length > 0 && active) {
            const url = URL.createObjectURL(
              new Blob([new Uint8Array(att.bytes)], {
                type: att.mimeType || 'image/jpeg',
              })
            );
            createdUrls.push(url);
            map[ph.blobKey] = url;
          }
        }
      }
      if (active) {
        setPhotoPreviewUrls(map);
      }
    };

    void loadAllPreviews();
    return () => {
      active = false;
      createdUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [er.programs]);

  const handleTrainerChange = (
    id: string,
    field: 'name' | 'nationalId' | 'mobile' | 'qualification',
    value: string
  ) => {
    onUpdateExecution((prev) => ({
      ...prev,
      trainers: prev.trainers.map((t) =>
        t.id === id ? { ...t, [field]: value } : t
      ),
    }));
  };

  const handleAddTrainer = () => {
    onUpdateExecution((prev) => ({
      ...prev,
      trainers: [...prev.trainers, createEmptyTrainerEntry()],
    }));
  };

  const handleRemoveTrainer = (id: string) => {
    onUpdateExecution((prev) => {
      if (prev.trainers.length <= 1) return prev;
      return {
        ...prev,
        trainers: prev.trainers.filter((t) => t.id !== id),
      };
    });
  };

  const handleProgramChange = (
    id: string,
    field:
      | 'programName'
      | 'daysCount'
      | 'hoursCount'
      | 'traineesCount'
      | 'trainerName'
      | 'vesselType'
      | 'executionDate'
      | 'executionLocation'
      | 'targetAudience',
    value: string
  ) => {
    onUpdateExecution((prev) => ({
      ...prev,
      programs: prev.programs.map((p) =>
        p.id === id ? { ...p, [field]: value } : p
      ),
    }));
  };

  const handleAddProgram = () => {
    const newEntry = createEmptyExecutedProgramEntry();
    onUpdateExecution((prev) => ({
      ...prev,
      programs: [...prev.programs, newEntry],
    }));
  };

  const handleRemoveProgram = (id: string) => {
    onUpdateExecution((prev) => {
      if (prev.programs.length <= 1) return prev;
      return {
        ...prev,
        programs: prev.programs.filter((p) => p.id !== id),
      };
    });
  };

  const handleApplyBatchBeneficiaries = (progId: string) => {
    const raw = batchTextByProg[progId] || '';
    const parsed = parseBatchBeneficiaryLines(raw);
    if (parsed.length === 0) return;
    onUpdateExecution((prev) => ({
      ...prev,
      programs: prev.programs.map((p) => {
        if (p.id !== progId) return p;
        const merged = [...p.beneficiaries, ...parsed];
        return {
          ...p,
          beneficiaries: merged,
          traineesCount: p.traineesCount.trim()
            ? p.traineesCount
            : String(merged.length),
        };
      }),
    }));
    setBatchTextByProg((prev) => ({ ...prev, [progId]: '' }));
  };

  const handleAddSingleBeneficiary = (progId: string) => {
    onUpdateExecution((prev) => ({
      ...prev,
      programs: prev.programs.map((p) =>
        p.id === progId
          ? {
              ...p,
              beneficiaries: [
                ...p.beneficiaries,
                {
                  id: createEntityId('ben'),
                  name: '',
                  nationalId: '',
                  hoursCount: '',
                },
              ],
            }
          : p
      ),
    }));
  };

  const handleUpdateBeneficiary = (
    progId: string,
    benId: string,
    field: 'name' | 'nationalId' | 'hoursCount',
    value: string
  ) => {
    onUpdateExecution((prev) => ({
      ...prev,
      programs: prev.programs.map((p) =>
        p.id === progId
          ? {
              ...p,
              beneficiaries: p.beneficiaries.map((b) =>
                b.id === benId ? { ...b, [field]: value } : b
              ),
            }
          : p
      ),
    }));
  };

  const handleRemoveBeneficiary = (progId: string, benId: string) => {
    onUpdateExecution((prev) => ({
      ...prev,
      programs: prev.programs.map((p) =>
        p.id === progId
          ? {
              ...p,
              beneficiaries: p.beneficiaries.filter((b) => b.id !== benId),
            }
          : p
      ),
    }));
  };

  const handleUploadEvidencePhotos = async (
    progId: string,
    files: FileList | null
  ) => {
    if (!files || files.length === 0) return;
    const repo = getDefaultPdAttachmentRepository();
    const addedRefs: PdEvidencePhotoRef[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const buffer = await file.arrayBuffer();
      const blobKey = createEntityId('pd_photo');
      await repo.saveAttachment({
        blobKey,
        mimeType: file.type || 'image/jpeg',
        bytes: new Uint8Array(buffer),
        createdAt: new Date().toISOString(),
      });
      addedRefs.push({
        id: createEntityId('ev_ref'),
        blobKey,
        title: file.name.replace(/\.[^.]+$/, '') || 'شاهد تنفيذ',
        mimeType: file.type || 'image/jpeg',
        createdAt: new Date().toISOString(),
      });
    }

    onUpdateExecution((prev) => ({
      ...prev,
      programs: prev.programs.map((p) =>
        p.id === progId
          ? { ...p, evidencePhotos: [...p.evidencePhotos, ...addedRefs] }
          : p
      ),
    }));
  };

  const handleRemoveEvidencePhoto = async (progId: string, photo: PdEvidencePhotoRef) => {
    const repo = getDefaultPdAttachmentRepository();
    await repo.deleteAttachment(photo.blobKey);
    onUpdateExecution((prev) => ({
      ...prev,
      programs: prev.programs.map((p) =>
        p.id === progId
          ? {
              ...p,
              evidencePhotos: p.evidencePhotos.filter((ph) => ph.id !== photo.id),
            }
          : p
      ),
    }));
  };

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      const { pdfBytes, filename } = await generatePdExecutionReportPdfBytes(
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
    <div className="space-y-5" dir="rtl" data-testid="pd-execution-report-engine">
      {/* Top Header */}
      <div className="rounded-xl border border-stone-200 bg-white p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-bold font-display text-stone-900">
            تقرير تنفيذ برنامج تطوير مهني (ضمن مشروع توطين التطوير المهني بالمدارس للعام {header.academicYear})
          </h2>
          <p className="text-xs sm:text-sm text-stone-600">
            {pdTerms.executionSubtitle}
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportPdf}
          disabled={isExporting}
          className="min-h-[40px] px-4 py-2 rounded-lg bg-[#477B59] hover:bg-[#386347] disabled:opacity-60 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
        >
          <FileDown className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{isExporting ? 'جاري التصدير...' : 'تصدير تقرير التنفيذ PDF'}</span>
        </button>
      </div>

      {/* أولاً- بيانات المدرسة */}
      <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-4">
        <h3 className="text-base font-bold font-display text-stone-900 border-b border-stone-100 pb-2.5">
          أولاً- بيانات المدرسة:
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1 text-xs">
            <span className="font-semibold text-stone-600 block">اسم المدرسة</span>
            <div className="min-h-[40px] px-3 py-2 rounded-lg border border-stone-200 bg-stone-50 text-sm font-bold text-stone-900 flex items-center">
              {header.schoolName}
            </div>
          </div>

          <label className="space-y-1 text-xs font-semibold text-stone-700">
            <span>المرحلة</span>
            <input
              type="text"
              value={er.stageLabel}
              onChange={(e) =>
                onUpdateExecution((prev) => ({
                  ...prev,
                  stageLabel: e.target.value,
                }))
              }
              placeholder={
                period.schoolStages.length > 0
                  ? period.schoolStages.join(' / ')
                  : 'مثال: ابتدائي / متوسط / ثانوي'
              }
              className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#477B59]"
            />
          </label>

          <label className="space-y-1 text-xs font-semibold text-stone-700">
            <span>{pdTerms.teachersCountLabel}</span>
            <input
              type="number"
              min="0"
              value={er.totalTeachersCount}
              onChange={(e) =>
                onUpdateExecution((prev) => ({
                  ...prev,
                  totalTeachersCount: e.target.value,
                }))
              }
              className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm text-stone-900 tabular-nums focus:outline-none focus:border-[#477B59]"
            />
          </label>

          <label className="space-y-1 text-xs font-semibold text-stone-700">
            <span>{pdTerms.participatingTeachersCountLabel}</span>
            <input
              type="number"
              min="0"
              value={er.participatingTeachersCount}
              onChange={(e) =>
                onUpdateExecution((prev) => ({
                  ...prev,
                  participatingTeachersCount: e.target.value,
                }))
              }
              className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm text-stone-900 tabular-nums focus:outline-none focus:border-[#477B59]"
            />
          </label>
        </div>
      </div>

      {/* ثانياً- بيانات المدربين / المدربات */}
      <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-3">
          <h3 className="text-base font-bold font-display text-stone-900">
            {pdTerms.trainersSectionHeading} ({er.trainers.length} صفوف)
          </h3>
          <button
            type="button"
            onClick={handleAddTrainer}
            className="min-h-[38px] px-3.5 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-xs font-semibold text-[#477B59] inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>{pdTerms.addTrainerLabel}</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-xs">
            <thead>
              <tr className="bg-stone-100 text-stone-900 border-b border-stone-300">
                <th className="p-2.5 border-l border-stone-300 w-12 text-center font-bold">
                  م
                </th>
                <th className="p-2.5 border-l border-stone-300 text-center font-bold">
                  {pdTerms.trainerNameLabel}
                </th>
                <th className="p-2.5 border-l border-stone-300 w-44 text-center font-bold">
                  السجل المدني
                </th>
                <th className="p-2.5 border-l border-stone-300 w-40 text-center font-bold">
                  رقم الجوال
                </th>
                <th className="p-2.5 border-l border-stone-300 w-44 text-center font-bold">
                  المؤهل الدراسي
                </th>
                <th className="p-2.5 w-12 text-center font-bold">حذف</th>
              </tr>
            </thead>
            <tbody>
              {er.trainers.map((tr, idx) => (
                <tr key={tr.id} className="border-b border-stone-200">
                  <td className="p-2 border-l border-stone-200 text-center font-bold bg-stone-50 tabular-nums">
                    {idx + 1}
                  </td>
                  <td className="p-1.5 border-l border-stone-200">
                    <input
                      type="text"
                      aria-label={`اسم ${pdTerms.trainerAriaNoun} ${idx + 1}`}
                      value={tr.name}
                      onChange={(e) =>
                        handleTrainerChange(tr.id, 'name', e.target.value)
                      }
                      className="w-full px-2.5 py-1.5 rounded border border-stone-200 bg-white text-xs text-stone-900 focus:outline-none focus:border-[#477B59]"
                    />
                  </td>
                  <td className="p-1.5 border-l border-stone-200">
                    <input
                      type="text"
                      aria-label={`السجل المدني ${pdTerms.trainerPossessivePrefix} ${idx + 1}`}
                      value={tr.nationalId}
                      onChange={(e) =>
                        handleTrainerChange(tr.id, 'nationalId', e.target.value)
                      }
                      className="w-full px-2.5 py-1.5 rounded border border-stone-200 bg-white text-xs text-center text-stone-900 tabular-nums focus:outline-none focus:border-[#477B59]"
                    />
                  </td>
                  <td className="p-1.5 border-l border-stone-200">
                    <input
                      type="text"
                      aria-label={`رقم الجوال ${pdTerms.trainerPossessivePrefix} ${idx + 1}`}
                      value={tr.mobile}
                      onChange={(e) =>
                        handleTrainerChange(tr.id, 'mobile', e.target.value)
                      }
                      className="w-full px-2.5 py-1.5 rounded border border-stone-200 bg-white text-xs text-center text-stone-900 tabular-nums focus:outline-none focus:border-[#477B59]"
                    />
                  </td>
                  <td className="p-1.5 border-l border-stone-200">
                    <input
                      type="text"
                      aria-label={`المؤهل الدراسي ${pdTerms.trainerPossessivePrefix} ${idx + 1}`}
                      value={tr.qualification}
                      onChange={(e) =>
                        handleTrainerChange(tr.id, 'qualification', e.target.value)
                      }
                      className="w-full px-2.5 py-1.5 rounded border border-stone-200 bg-white text-xs text-stone-900 focus:outline-none focus:border-[#477B59]"
                    />
                  </td>
                  <td className="p-1.5 text-center">
                    {er.trainers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveTrainer(tr.id)}
                        aria-label={`حذف ${pdTerms.trainerAriaNoun} ${idx + 1}`}
                        className="p-1.5 rounded text-stone-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ثالثاً- بيانات البرامج المنفذة (صفوف غير محدودة + ربط المستفيدين والشواهد) */}
      <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-3">
          <div>
            <h3 className="text-base font-bold font-display text-stone-900">
              ثالثاً- بيانات البرامج المنفذة: ({er.programs.length} صفوف)
            </h3>
            <p className="text-xs text-stone-500">
              {pdTerms.beneficiariesEvidenceHint}
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddProgram}
            className="min-h-[38px] px-3.5 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-xs font-semibold text-[#477B59] inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>إضافة برنامج منفذ</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse text-xs">
            <thead>
              <tr className="bg-stone-100 text-stone-900 border-b border-stone-300">
                <th className="p-2.5 border-l border-stone-300 w-12 text-center font-bold">
                  م
                </th>
                <th className="p-2.5 border-l border-stone-300 text-center font-bold">
                  اسم البرنامج
                </th>
                <th className="p-2.5 border-l border-stone-300 w-24 text-center font-bold">
                  عدد الأيام
                </th>
                <th className="p-2.5 border-l border-stone-300 w-24 text-center font-bold">
                  عدد الساعات
                </th>
                <th className="p-2.5 border-l border-stone-300 w-28 text-center font-bold">
                  {pdTerms.traineesCountLabel}
                </th>
                <th className="p-2.5 border-l border-stone-300 w-44 text-center font-bold">
                  {pdTerms.trainerExecutorLabel}
                </th>
                <th className="p-2.5 border-l border-stone-300 w-44 text-center font-bold">
                  {`البيانات و${pdTerms.beneficiariesWithEvidenceLabel}`}
                </th>
                <th className="p-2.5 w-12 text-center font-bold">حذف</th>
              </tr>
            </thead>
            <tbody>
              {er.programs.map((prog, idx) => {
                const isExpanded = expandedProgramId === prog.id;
                return (
                  <React.Fragment key={prog.id}>
                    <tr className="border-b border-stone-200">
                      <td className="p-2 border-l border-stone-200 text-center font-bold bg-stone-50 tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="p-1.5 border-l border-stone-200">
                        <input
                          type="text"
                          aria-label={`اسم البرنامج المنفذ ${idx + 1}`}
                          value={prog.programName}
                          onChange={(e) =>
                            handleProgramChange(prog.id, 'programName', e.target.value)
                          }
                          placeholder="اسم البرنامج..."
                          className="w-full px-2.5 py-1.5 rounded border border-stone-200 bg-white text-xs text-stone-900 focus:outline-none focus:border-[#477B59]"
                        />
                      </td>
                      <td className="p-1.5 border-l border-stone-200">
                        <input
                          type="number"
                          min="0"
                          aria-label={`عدد الأيام للبرنامج ${idx + 1}`}
                          value={prog.daysCount}
                          onChange={(e) =>
                            handleProgramChange(prog.id, 'daysCount', e.target.value)
                          }
                          className="w-full px-2 py-1.5 rounded border border-stone-200 bg-white text-xs text-center text-stone-900 tabular-nums focus:outline-none focus:border-[#477B59]"
                        />
                      </td>
                      <td className="p-1.5 border-l border-stone-200">
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          aria-label={`عدد الساعات للبرنامج ${idx + 1}`}
                          value={prog.hoursCount}
                          onChange={(e) =>
                            handleProgramChange(prog.id, 'hoursCount', e.target.value)
                          }
                          className="w-full px-2 py-1.5 rounded border border-stone-200 bg-white text-xs text-center text-stone-900 tabular-nums focus:outline-none focus:border-[#477B59]"
                        />
                      </td>
                      <td className="p-1.5 border-l border-stone-200">
                        <input
                          type="number"
                          min="0"
                          aria-label={`${pdTerms.traineesCountLabel} للبرنامج ${idx + 1}`}
                          value={prog.traineesCount}
                          onChange={(e) =>
                            handleProgramChange(prog.id, 'traineesCount', e.target.value)
                          }
                          className="w-full px-2 py-1.5 rounded border border-stone-200 bg-white text-xs text-center text-stone-900 tabular-nums focus:outline-none focus:border-[#477B59]"
                        />
                      </td>
                      <td className="p-1.5 border-l border-stone-200">
                        <input
                          type="text"
                          aria-label={`${pdTerms.trainerExecutorLabel} للبرنامج ${idx + 1}`}
                          value={prog.trainerName}
                          onChange={(e) =>
                            handleProgramChange(prog.id, 'trainerName', e.target.value)
                          }
                          className="w-full px-2.5 py-1.5 rounded border border-stone-200 bg-white text-xs text-stone-900 focus:outline-none focus:border-[#477B59]"
                        />
                      </td>
                      <td className="p-1.5 border-l border-stone-200 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedProgramId(isExpanded ? null : prog.id)
                          }
                          aria-expanded={isExpanded}
                          className={`w-full px-2.5 py-1.5 rounded-md text-xs font-semibold inline-flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                            isExpanded
                              ? 'bg-[#477B59] text-white'
                              : 'bg-stone-100 hover:bg-stone-200 text-stone-800'
                          }`}
                        >
                          <Users className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span>
                            {pdTerms.beneficiariesWithEvidenceLabel} ({prog.beneficiaries.length})
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                          )}
                        </button>
                      </td>
                      <td className="p-1.5 text-center">
                        {er.programs.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveProgram(prog.id)}
                            aria-label={`حذف البرنامج ${idx + 1}`}
                            className="p-1.5 rounded text-stone-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </button>
                        )}
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="bg-stone-50/80 border-b border-stone-300">
                        <td colSpan={8} className="p-4 space-y-4">
                          {/* Linked Metadata for Engines 03 & 04 */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            <label className="space-y-1 text-xs font-semibold text-stone-700">
                              <span>نوع وعاء التطوير المهني</span>
                              <input
                                type="text"
                                value={prog.vesselType}
                                onChange={(e) =>
                                  handleProgramChange(
                                    prog.id,
                                    'vesselType',
                                    e.target.value
                                  )
                                }
                                placeholder="مثال: برنامج تدريبي / ورشة عمل"
                                className="w-full min-h-[36px] px-2.5 py-1.5 rounded border border-stone-300 bg-white text-xs text-stone-900"
                              />
                            </label>
                            <label className="space-y-1 text-xs font-semibold text-stone-700">
                              <span>تاريخ التنفيذ</span>
                              <input
                                type="text"
                                value={prog.executionDate}
                                onChange={(e) =>
                                  handleProgramChange(
                                    prog.id,
                                    'executionDate',
                                    e.target.value
                                  )
                                }
                                placeholder="مثال: 1448/4/15"
                                className="w-full min-h-[36px] px-2.5 py-1.5 rounded border border-stone-300 bg-white text-xs text-stone-900 tabular-nums"
                              />
                            </label>
                            <label className="space-y-1 text-xs font-semibold text-stone-700">
                              <span>مكان التنفيذ</span>
                              <input
                                type="text"
                                value={prog.executionLocation}
                                onChange={(e) =>
                                  handleProgramChange(
                                    prog.id,
                                    'executionLocation',
                                    e.target.value
                                  )
                                }
                                placeholder="مثال: قاعة التدريب بالمدرسة"
                                className="w-full min-h-[36px] px-2.5 py-1.5 rounded border border-stone-300 bg-white text-xs text-stone-900"
                              />
                            </label>
                            <label className="space-y-1 text-xs font-semibold text-stone-700">
                              <span>الفئة المستهدفة</span>
                              <input
                                type="text"
                                value={prog.targetAudience}
                                onChange={(e) =>
                                  handleProgramChange(
                                    prog.id,
                                    'targetAudience',
                                    e.target.value
                                  )
                                }
                                placeholder={pdTerms.targetAudiencePlaceholder}
                                className="w-full min-h-[36px] px-2.5 py-1.5 rounded border border-stone-300 bg-white text-xs text-stone-900"
                              />
                            </label>
                          </div>

                          {/* Beneficiaries & National IDs */}
                          <div className="rounded-lg border border-stone-200 bg-white p-3.5 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <h4 className="text-xs font-bold text-stone-900">
                                {pdTerms.beneficiariesListHeading} ({prog.beneficiaries.length}) — تُجمع ساعاتهم تلقائياً في التقرير الفصلي
                              </h4>
                              <button
                                type="button"
                                onClick={() => handleAddSingleBeneficiary(prog.id)}
                                className="px-2.5 py-1 rounded border border-stone-300 bg-white hover:bg-stone-50 text-xs font-semibold text-[#477B59] inline-flex items-center gap-1 cursor-pointer"
                              >
                                <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>{pdTerms.addBeneficiaryLabel}</span>
                              </button>
                            </div>

                            {prog.beneficiaries.length > 0 && (
                              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                                {prog.beneficiaries.map((ben, bIdx) => (
                                  <div
                                    key={ben.id}
                                    className="grid grid-cols-12 gap-2 items-center"
                                  >
                                    <span className="col-span-1 text-center font-bold text-stone-500 tabular-nums">
                                      {bIdx + 1}
                                    </span>
                                    <input
                                      type="text"
                                      placeholder="الاسم الكامل"
                                      aria-label={`اسم ${pdTerms.beneficiaryDefinite} ${bIdx + 1}`}
                                      value={ben.name}
                                      onChange={(e) =>
                                        handleUpdateBeneficiary(
                                          prog.id,
                                          ben.id,
                                          'name',
                                          e.target.value
                                        )
                                      }
                                      className="col-span-5 px-2 py-1 rounded border border-stone-300 bg-white text-xs"
                                    />
                                    <input
                                      type="text"
                                      placeholder="الهوية الوطنية (10 أرقام)"
                                      aria-label={`الهوية الوطنية ${settings.gender === 'female' ? 'للمستفيدة' : 'للمستفيد'} ${bIdx + 1}`}
                                      value={ben.nationalId}
                                      onChange={(e) =>
                                        handleUpdateBeneficiary(
                                          prog.id,
                                          ben.id,
                                          'nationalId',
                                          e.target.value
                                        )
                                      }
                                      className="col-span-4 px-2 py-1 rounded border border-stone-300 bg-white text-xs tabular-nums"
                                    />
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.5"
                                      placeholder={prog.hoursCount || 'الساعات'}
                                      aria-label={`ساعات ${pdTerms.beneficiaryDefinite} ${bIdx + 1}`}
                                      value={ben.hoursCount || ''}
                                      onChange={(e) =>
                                        handleUpdateBeneficiary(
                                          prog.id,
                                          ben.id,
                                          'hoursCount',
                                          e.target.value
                                        )
                                      }
                                      className="col-span-1 px-1.5 py-1 rounded border border-stone-300 bg-white text-xs text-center tabular-nums"
                                    />
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleRemoveBeneficiary(prog.id, ben.id)
                                      }
                                      aria-label={`حذف ${pdTerms.beneficiaryDefinite} ${bIdx + 1}`}
                                      className="col-span-1 p-1 text-stone-400 hover:text-red-600 flex justify-center cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Batch Paste Tool */}
                            <div className="pt-2 border-t border-stone-100 space-y-2">
                              <label className="block text-[11px] font-semibold text-stone-600">
                                {pdTerms.beneficiariesBatchLabel}
                              </label>
                              <div className="flex flex-col sm:flex-row gap-2">
                                <textarea
                                  rows={2}
                                  value={batchTextByProg[prog.id] || ''}
                                  onChange={(e) =>
                                    setBatchTextByProg((prev) => ({
                                      ...prev,
                                      [prog.id]: e.target.value,
                                    }))
                                  }
                                  placeholder={pdTerms.beneficiariesBatchPlaceholder}
                                  className="flex-1 px-2.5 py-1.5 rounded border border-stone-300 bg-stone-50 text-xs text-stone-900"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleApplyBatchBeneficiaries(prog.id)}
                                  className="px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold self-end cursor-pointer whitespace-nowrap"
                                >
                                  إدراج القائمة
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Evidence Photos */}
                          <div className="rounded-lg border border-stone-200 bg-white p-3.5 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <h4 className="text-xs font-bold text-stone-900">
                                الصور وشواهد التنفيذ المرفقة ({prog.evidencePhotos.length}) — تُرفق تلقائياً في ملف PDF
                              </h4>
                              <label className="px-3 py-1.5 rounded-lg border border-[#477B59] text-[#477B59] hover:bg-[#E1EFE5] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer">
                                <ImagePlus className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>رفع صور شواهد</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  className="sr-only"
                                  onChange={(e) => {
                                    void handleUploadEvidencePhotos(
                                      prog.id,
                                      e.target.files
                                    );
                                    e.target.value = '';
                                  }}
                                />
                              </label>
                            </div>

                            {prog.evidencePhotos.length > 0 && (
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {prog.evidencePhotos.map((ph) => (
                                  <div
                                    key={ph.id}
                                    className="rounded-lg border border-stone-200 p-2 bg-stone-50 space-y-1.5"
                                  >
                                    {photoPreviewUrls[ph.blobKey] ? (
                                      <img
                                        src={photoPreviewUrls[ph.blobKey]}
                                        alt={ph.title}
                                        className="w-full h-24 object-cover rounded border border-stone-200 bg-white"
                                      />
                                    ) : (
                                      <div className="w-full h-24 rounded border border-stone-200 bg-white flex items-center justify-center text-[11px] text-stone-400">
                                        شاهد محفوظ
                                      </div>
                                    )}
                                    <div className="flex items-center justify-between gap-1">
                                      <span className="text-[11px] font-medium text-stone-700 truncate">
                                        {ph.title}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          void handleRemoveEvidencePhoto(prog.id, ph)
                                        }
                                        aria-label={`حذف الصورة ${ph.title}`}
                                        className="p-1 text-stone-400 hover:text-red-600 cursor-pointer shrink-0"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Signoff Section (borderless signature names) */}
      <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-center">
          <label className="flex flex-col items-center space-y-1 text-xs font-semibold text-stone-700">
            <span>{header.coordinatorTitle}</span>
            <input
              type="text"
              value={er.coordinatorAuthName}
              onChange={(e) =>
                onUpdateExecution((prev) => ({
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
              value={er.principalAuthName}
              onChange={(e) =>
                onUpdateExecution((prev) => ({
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
