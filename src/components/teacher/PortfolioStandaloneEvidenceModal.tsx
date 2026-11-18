import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, FilePlus2, Save, X } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import { TeacherPdfColorSystem } from '../../types';
import {
  cleanupUnreferencedStagedPhotoDataUrls,
  createEmptyStandaloneEvidenceInput,
  loadStandaloneEvidenceWithMedia,
  ResolvedPortfolioElementSummary,
  saveStandaloneEvidenceToElement,
  TEACHER_STANDALONE_EVIDENCE_TYPES,
  TeacherPortfolioStandaloneEvidence,
  TeacherPortfolioStandaloneFormInput,
  TeacherStandaloneEvidenceType,
} from '../../utils/teacherPortfolioEngine';
import { TeacherEvidenceSection } from './TeacherEvidenceSection';

export interface PortfolioStandaloneEvidenceModalProps {
  element: ResolvedPortfolioElementSummary;
  mode: 'create' | 'edit';
  editingEvidenceId?: string;
  colorSystem: TeacherPdfColorSystem;
  onClose: () => void;
  onSaved: (
    savedEvidence: TeacherPortfolioStandaloneEvidence,
    isNew: boolean
  ) => void;
}

function buildFormDirtySignature(
  data: TeacherPortfolioStandaloneFormInput
): string {
  return JSON.stringify({
    evidenceType: data.evidenceType,
    title: data.title,
    executionDate: data.executionDate,
    targetAudience: data.targetAudience,
    description: data.description,
    impact: data.impact,
    evidencePhotos: (data.evidencePhotos || []).map((p) => p.imageDataUrl),
    evidenceLinks: (data.evidenceLinks || []).map((l) => l.url || ''),
  });
}

export const PortfolioStandaloneEvidenceModal: React.FC<
  PortfolioStandaloneEvidenceModalProps
> = ({
  element,
  mode,
  editingEvidenceId,
  colorSystem,
  onClose,
  onSaved,
}) => {
  const { settings } = useSettings();
  const [formData, setFormData] = useState<TeacherPortfolioStandaloneFormInput>(
    () => createEmptyStandaloneEvidenceInput(settings)
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExitConfirmOpen, setIsExitConfirmOpen] = useState(false);
  const [isCleaningOnExit, setIsCleaningOnExit] = useState(false);
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loadWarning, setLoadWarning] = useState<string | null>(null);

  const initialSignatureRef = useRef<string>(
    buildFormDirtySignature(createEmptyStandaloneEvidenceInput(settings))
  );
  const stagedPhotoDataUrlsRef = useRef<Set<string>>(new Set());

  // Initialize clean empty form (create) or hydrate existing saved evidence (edit)
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setIsExitConfirmOpen(false);
    setValidationErrors({});
    setSubmitError(null);
    setLoadWarning(null);
    stagedPhotoDataUrlsRef.current.clear();

    if (mode === 'edit' && editingEvidenceId) {
      loadStandaloneEvidenceWithMedia({
        elementId: element.id,
        evidenceId: editingEvidenceId,
      })
        .then((res) => {
          if (cancelled) return;
          if (!res) {
            setSubmitError('تعذر العثور على الشاهد المستقل المطلوب تعديله.');
            setIsLoading(false);
            return;
          }
          setFormData(res.formData);
          initialSignatureRef.current = buildFormDirtySignature(res.formData);
          if (res.integrityWarnings.length > 0) {
            setLoadWarning(res.integrityWarnings.join(' — '));
          }
          setIsLoading(false);
        })
        .catch(() => {
          if (!cancelled) {
            setSubmitError('حدث خطأ أثناء تحميل بيانات الشاهد للتعديل.');
            setIsLoading(false);
          }
        });
    } else {
      const freshEmpty = createEmptyStandaloneEvidenceInput(settings);
      setFormData(freshEmpty);
      initialSignatureRef.current = buildFormDirtySignature(freshEmpty);
      setIsLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [element.id, mode, editingEvidenceId, settings]);

  const isDirty =
    !isLoading &&
    buildFormDirtySignature(formData) !== initialSignatureRef.current;

  const handleAttemptClose = () => {
    if (isSubmitting || isCleaningOnExit) return;
    if (isDirty) {
      setIsExitConfirmOpen(true);
      return;
    }
    onClose();
  };

  const handleConfirmExitWithoutSaving = async () => {
    if (isCleaningOnExit) return;
    setIsCleaningOnExit(true);
    try {
      const staged = Array.from(stagedPhotoDataUrlsRef.current);
      if (staged.length > 0) {
        await cleanupUnreferencedStagedPhotoDataUrls(staged);
      }
      setIsExitConfirmOpen(false);
      onClose();
    } finally {
      setIsCleaningOnExit(false);
    }
  };

  const handleSaveFinal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || isLoading) return;

    setIsSubmitting(true);
    setValidationErrors({});
    setSubmitError(null);

    try {
      const res = await saveStandaloneEvidenceToElement({
        elementId: element.id,
        formData,
        editingEvidenceId: mode === 'edit' ? editingEvidenceId : undefined,
        settings,
      });

      if (!res.ok) {
        if (res.validationErrors) {
          setValidationErrors(res.validationErrors);
        }
        setSubmitError(
          res.errorMessage || 'تعذر حفظ الشاهد المستقل. يرجى التحقق من المدخلات.'
        );
        setIsSubmitting(false);
        return;
      }

      const retainedUrls = new Set(
        (formData.evidencePhotos || []).map((p) => p.imageDataUrl)
      );
      const replacedStaged = Array.from(stagedPhotoDataUrlsRef.current).filter(
        (url) => !retainedUrls.has(url)
      );
      if (replacedStaged.length > 0) {
        await cleanupUnreferencedStagedPhotoDataUrls(replacedStaged);
      }

      if (res.evidence) {
        onSaved(res.evidence, res.isNew);
      }
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'حدث خطأ غير متوقع أثناء الحفظ.'
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="standalone-evidence-modal-title"
      data-testid="portfolio-standalone-evidence-modal"
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
    >
      <form
        onSubmit={handleSaveFinal}
        noValidate
        className="relative bg-white rounded-2xl border border-stone-200 w-full max-w-5xl max-h-[92vh] flex flex-col shadow-xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-100 flex items-start justify-between gap-3 bg-stone-50/80">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#1E4D8C]">
              <FilePlus2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>
                {mode === 'edit'
                  ? `تعديل شاهد مستقل · العنصر (${element.number})`
                  : `إنشاء شاهد مستقل · العنصر (${element.number})`}
              </span>
            </div>
            <h3
              id="standalone-evidence-modal-title"
              className="text-base sm:text-lg font-extrabold text-stone-900"
            >
              {element.number}. {element.title}
            </h3>
            <p className="text-xs text-stone-600">
              نموذج توثيقي موحد ومباشر داخل العنصر؛ يُحفظ الشاهد في العنصر عند
              استكمال الحقول الإلزامية والضغط على زر الحفظ.
            </p>
          </div>

          <button
            type="button"
            data-testid="close-standalone-modal-btn"
            aria-label="إغلاق نافذة الشاهد المستقل"
            onClick={handleAttemptClose}
            className="p-2 rounded-xl bg-white border border-stone-200 hover:bg-stone-100 text-stone-700 cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {isLoading ? (
            <div className="py-10 text-center text-sm font-bold text-stone-600">
              جاري تجهيز النموذج...
            </div>
          ) : (
            <>
              {loadWarning && (
                <div
                  role="alert"
                  className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-bold text-amber-900"
                >
                  {loadWarning}
                </div>
              )}

              {submitError && (
                <div
                  role="alert"
                  data-testid="standalone-form-error-banner"
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs sm:text-sm font-bold text-red-800"
                >
                  {submitError}
                </div>
              )}

              {/* Row 1: Evidence Type + Execution Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="standalone-evidence-type"
                    className="block text-xs sm:text-sm font-extrabold text-stone-800"
                  >
                    نوع التوثيق
                  </label>
                  <select
                    id="standalone-evidence-type"
                    data-testid="standalone-evidence-type-select"
                    value={formData.evidenceType}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        evidenceType: e.target
                          .value as TeacherStandaloneEvidenceType,
                      }))
                    }
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm font-bold text-stone-900 focus:outline-none focus:border-[#2563EB]"
                  >
                    {TEACHER_STANDALONE_EVIDENCE_TYPES.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="standalone-execution-date"
                    className="block text-xs sm:text-sm font-extrabold text-stone-800"
                  >
                    تاريخ التنفيذ{' '}
                    <span className="text-xs font-normal text-stone-500">
                      (اختياري)
                    </span>
                  </label>
                  <input
                    id="standalone-execution-date"
                    type="text"
                    data-testid="standalone-execution-date-input"
                    value={formData.executionDate}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        executionDate: e.target.value,
                      }))
                    }
                    placeholder="مثال: 1447/05/12هـ"
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-[#2563EB]"
                  />
                </div>
              </div>

              {/* Row 2: Title (Required on save) */}
              <div className="space-y-1.5">
                <label
                  htmlFor="standalone-evidence-title"
                  className="block text-xs sm:text-sm font-extrabold text-stone-800"
                >
                  عنوان الشاهد <span className="text-red-600">*</span>
                </label>
                <input
                  id="standalone-evidence-title"
                  type="text"
                  data-testid="standalone-title-input"
                  aria-invalid={Boolean(validationErrors.title)}
                  value={formData.title}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData((prev) => ({ ...prev, title: val }));
                    if (validationErrors.title && val.trim()) {
                      setValidationErrors((prev) => {
                        const next = { ...prev };
                        delete next.title;
                        return next;
                      });
                    }
                  }}
                  placeholder="أدخل عنوانًا واضحًا ومختصرًا للشاهد..."
                  className={`w-full min-h-[42px] px-3.5 py-2 rounded-xl border bg-white text-xs sm:text-sm text-stone-900 focus:outline-none ${
                    validationErrors.title
                      ? 'border-red-400 focus:border-red-600'
                      : 'border-stone-300 focus:border-[#2563EB]'
                  }`}
                />
                {validationErrors.title && (
                  <p
                    data-testid="standalone-title-error"
                    className="text-xs font-bold text-red-700"
                  >
                    {validationErrors.title}
                  </p>
                )}
              </div>

              {/* Row 3: Target Audience (Optional) */}
              <div className="space-y-1.5">
                <label
                  htmlFor="standalone-target-audience"
                  className="block text-xs sm:text-sm font-extrabold text-stone-800"
                >
                  الصف أو الفئة المستهدفة{' '}
                  <span className="text-xs font-normal text-stone-500">
                    (عند الحاجة — اختياري)
                  </span>
                </label>
                <input
                  id="standalone-target-audience"
                  type="text"
                  data-testid="standalone-target-audience-input"
                  value={formData.targetAudience}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      targetAudience: e.target.value,
                    }))
                  }
                  placeholder="مثال: الصف الخامس الابتدائي / أولياء الأمور / معلمو التخصص"
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              {/* Row 4: Description (Required on save) */}
              <div className="space-y-1.5">
                <label
                  htmlFor="standalone-description"
                  className="block text-xs sm:text-sm font-extrabold text-stone-800"
                >
                  وصف الممارسة أو العمل المنفذ{' '}
                  <span className="text-red-600">*</span>
                </label>
                <textarea
                  id="standalone-description"
                  rows={4}
                  data-testid="standalone-description-input"
                  aria-invalid={Boolean(validationErrors.description)}
                  value={formData.description}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData((prev) => ({ ...prev, description: val }));
                    if (validationErrors.description && val.trim()) {
                      setValidationErrors((prev) => {
                        const next = { ...prev };
                        delete next.description;
                        return next;
                      });
                    }
                  }}
                  placeholder="اذكر بإيجاز الخطوات المنفذة أو الممارسة التعليمية الموثقة..."
                  className={`w-full px-3.5 py-2.5 rounded-xl border bg-white text-xs sm:text-sm text-stone-900 leading-relaxed focus:outline-none ${
                    validationErrors.description
                      ? 'border-red-400 focus:border-red-600'
                      : 'border-stone-300 focus:border-[#2563EB]'
                  }`}
                />
                {validationErrors.description && (
                  <p
                    data-testid="standalone-description-error"
                    className="text-xs font-bold text-red-700"
                  >
                    {validationErrors.description}
                  </p>
                )}
              </div>

              {/* Row 5: Impact / Outcome (Optional) */}
              <div className="space-y-1.5">
                <label
                  htmlFor="standalone-impact"
                  className="block text-xs sm:text-sm font-extrabold text-stone-800"
                >
                  الأثر أو النتيجة المتحققة{' '}
                  <span className="text-xs font-normal text-stone-500">
                    (اختياري)
                  </span>
                </label>
                <textarea
                  id="standalone-impact"
                  rows={2}
                  data-testid="standalone-impact-input"
                  value={formData.impact}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, impact: e.target.value }))
                  }
                  placeholder="مثال: تحسن مشاركة الطلاب وتفاعلهم مع الأنشطة الصفية..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 leading-relaxed focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              {/* Row 6: Reused Untouched TeacherEvidenceSection (Photos + QR Links) */}
              <TeacherEvidenceSection
                photos={formData.evidencePhotos}
                links={formData.evidenceLinks}
                colorSystem={colorSystem}
                enableMediaStore={true}
                onChangePhotos={(nextPhotos) => {
                  for (const p of nextPhotos) {
                    if (p?.imageDataUrl) {
                      stagedPhotoDataUrlsRef.current.add(p.imageDataUrl);
                    }
                  }
                  setFormData((prev) => ({
                    ...prev,
                    evidencePhotos: nextPhotos,
                  }));
                }}
                onChangeLinks={(nextLinks) =>
                  setFormData((prev) => ({
                    ...prev,
                    evidenceLinks: nextLinks,
                  }))
                }
              />
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-stone-100 bg-stone-50 flex flex-wrap items-center justify-between gap-2.5">
          <button
            type="button"
            data-testid="cancel-standalone-modal-btn"
            onClick={handleAttemptClose}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-white border border-stone-300 hover:bg-stone-100 text-xs font-bold text-stone-800 cursor-pointer transition-colors"
          >
            {mode === 'edit' ? 'إلغاء التعديلات' : 'إغلاق'}
          </button>

          <button
            type="submit"
            disabled={isLoading || isSubmitting}
            data-testid="save-standalone-evidence-btn"
            className="min-h-[42px] px-5 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 text-white text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 cursor-pointer transition-colors shadow-2xs"
          >
            <Save className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>
              {isSubmitting
                ? 'جاري الحفظ...'
                : mode === 'edit'
                  ? 'حفظ التعديلات'
                  : 'حفظ الشاهد في العنصر'}
            </span>
          </button>
        </div>

        {/* Unsaved Changes Exit Confirmation Overlay */}
        {isExitConfirmOpen && (
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="unsaved-exit-confirm-title"
            data-testid="standalone-unsaved-exit-confirm"
            className="absolute inset-0 z-20 bg-black/50 flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-2xl border border-stone-200 w-full max-w-md p-6 space-y-4 shadow-2xl">
              <div className="flex items-center gap-3 text-amber-700">
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" aria-hidden="true" />
                </div>
                <h4
                  id="unsaved-exit-confirm-title"
                  className="text-base font-extrabold text-stone-900"
                >
                  البيانات غير المحفوظة ستُفقد
                </h4>
              </div>

              <p className="text-xs sm:text-sm text-stone-700 leading-relaxed">
                {mode === 'edit'
                  ? 'لديك تعديلات غير محفوظة على هذا الشاهد. في حال الخروج الآن قبل الضغط على زر الحفظ، ستُفقد التعديلات الحالية ويبقى الشاهد كما كان سابقًا.'
                  : 'لديك بيانات غير محفوظة في هذا النموذج. في حال الخروج الآن قبل الضغط على زر الحفظ، ستُفقد جميع البيانات المدخلة ولن يُحفظ الشاهد.'}
              </p>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  data-testid="cancel-unsaved-exit-btn"
                  disabled={isCleaningOnExit}
                  onClick={() => setIsExitConfirmOpen(false)}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-xs font-bold text-stone-800 cursor-pointer"
                >
                  إلغاء الخروج
                </button>
                <button
                  type="button"
                  data-testid="confirm-unsaved-exit-btn"
                  disabled={isCleaningOnExit}
                  onClick={handleConfirmExitWithoutSaving}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-xs font-extrabold cursor-pointer"
                >
                  {isCleaningOnExit ? 'جاري الإغلاق...' : 'الخروج دون حفظ'}
                </button>
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};
