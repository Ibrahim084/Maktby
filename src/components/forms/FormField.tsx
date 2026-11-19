import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  ClipboardPaste,
  ImagePlus,
  PenTool,
  Plus,
  ShieldAlert,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  EvidenceImageItem,
  FormFieldDefinition,
  FormFieldValue,
  TableRowData,
} from '../../types/forms';
import {
  addCustomMultiSelectOption,
  addEvidenceImages,
  addRepeatableItem,
  addTableRow,
  removeEvidenceImage,
  removeRepeatableItem,
  removeTableRow,
  selectSuggestedRepeatableItem,
  toggleArrayOption,
  updateEvidenceImageCaption,
  updateRepeatableItem,
  updateTableCell,
} from '../../utils/formEngine';
import { parseBatchTraineeNames } from '../../utils/zipBuilder';

interface FormFieldProps {
  field: FormFieldDefinition;
  value: FormFieldValue;
  error?: string;
  accentColorClass?: string;
  onChange: (fieldId: string, newValue: FormFieldValue) => void;
}

export const FormField: React.FC<FormFieldProps> = ({
  field,
  value,
  error,
  accentColorClass,
  onChange,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const signatureInputRef = useRef<HTMLInputElement | null>(null);
  const [customOptionInput, setCustomOptionInput] = useState<string>('');

  const handleImageSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const currentImages = Array.isArray(value)
      ? (value as EvidenceImageItem[])
      : [];
    const maxImages = field.maxImages ?? 6;
    const remainingSlots = Math.max(0, maxImages - currentImages.length);
    const selectedFiles = Array.from(files).slice(0, remainingSlots);

    if (selectedFiles.length === 0) {
      e.target.value = '';
      return;
    }

    Promise.all(
      selectedFiles.map(
        (file) =>
          new Promise<EvidenceImageItem>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              resolve({
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                name: file.name,
                dataUrl: typeof reader.result === 'string' ? reader.result : '',
                caption: '',
              });
            };
            reader.onerror = () =>
              reject(new Error('Failed to read image file'));
            reader.readAsDataURL(file);
          })
      )
    )
      .then((loadedItems) => {
        const updated = addEvidenceImages(
          currentImages,
          loadedItems,
          maxImages
        );
        onChange(field.id, updated);
      })
      .catch(() => {
        // Ignore unreadable image file
      });

    e.target.value = '';
  };

  const handleSignatureSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onChange(field.id, reader.result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleAddCustomMultiSelect = () => {
    const trimmed = customOptionInput.trim();
    if (!trimmed) return;
    const currentArr = Array.isArray(value) ? (value as string[]) : [];
    onChange(field.id, addCustomMultiSelectOption(currentArr, trimmed));
    setCustomOptionInput('');
  };

  const handlePasteFromClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          const currentText = typeof value === 'string' ? value.trim() : '';
          const merged = currentText ? `${currentText}\n${text.trim()}` : text.trim();
          onChange(field.id, merged);
        }
      }
    } catch {
      // Clipboard API may require direct Ctrl+V in restricted frames
    }
  };

  const repeatableArr =
    field.type === 'repeatable'
      ? Array.isArray(value) && value.length > 0
        ? (value as string[])
        : ['']
      : [];
  const isRepeatableAtMax = Boolean(
    field.maxRows && repeatableArr.length >= field.maxRows
  );

  const multiSelectArr =
    field.type === 'multi-select' && Array.isArray(value)
      ? (value as string[])
      : [];
  const allMultiSelectOptions =
    field.type === 'multi-select'
      ? [
          ...(field.options ?? []),
          ...multiSelectArr.filter(
            (item) => !(field.options ?? []).includes(item)
          ),
        ]
      : [];

  const parsedBatchLines =
    field.enableLineCountBadge && typeof value === 'string'
      ? parseBatchTraineeNames(value)
      : [];

  return (
    <>
      {field.sectionTitle && (
        <div className="col-span-1 md:col-span-2 pt-4 first:pt-0 border-t border-stone-200/80 first:border-t-0">
          <h3
            className={`text-base sm:text-lg font-extrabold font-display ${
              accentColorClass || 'text-stone-900'
            }`}
          >
            {field.sectionTitle}
          </h3>
          {field.sectionDescription && (
            <p className="text-xs sm:text-sm text-stone-500 mt-1">
              {field.sectionDescription}
            </p>
          )}
        </div>
      )}

      <div
        className={
          field.width === 'half' ? 'col-span-1' : 'col-span-1 md:col-span-2'
        }
      >
        {/* Field Label & Required/Optional Indicator */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <label
            htmlFor={`field-${field.id}`}
            className="text-sm font-bold text-stone-800"
          >
            {field.label}
            {field.required && (
              <span className="text-red-700 mr-1" aria-hidden="true">
                *
              </span>
            )}
          </label>
          <div className="flex items-center gap-2">
            {field.enableLineCountBadge && (
              <span
                data-testid="batch-names-count-badge"
                className="text-xs font-bold px-2.5 py-1 rounded-lg bg-stone-100 text-stone-800 tabular-nums"
              >
                عدد الأسماء المدخلة: {parsedBatchLines.length}
              </span>
            )}
            {field.enableClipboardPasteButton && (
              <button
                type="button"
                onClick={handlePasteFromClipboard}
                className="min-h-[32px] px-2.5 py-1 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 text-xs font-semibold text-stone-700 inline-flex items-center gap-1 cursor-pointer"
              >
                <ClipboardPaste className="w-3.5 h-3.5" aria-hidden="true" />
                <span>لصق قائمة أسماء</span>
              </button>
            )}
            <span className="text-xs text-stone-500">
              {field.required ? 'إلزامي' : 'اختياري'}
              {field.type === 'repeatable' && field.maxRows
                ? ` · (${repeatableArr.length} / ${field.maxRows})`
                : ''}
            </span>
          </div>
        </div>

        {field.helpText && (
          <p className="text-xs text-stone-500 mb-2.5 leading-relaxed">
            {field.helpText}
          </p>
        )}

        {/* Prominent Red Privacy Warning for Specific Fields (e.g., National ID) */}
        {field.privacyWarning && (
          <div
            data-testid={`privacy-warning-${field.id}`}
            className="mb-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs sm:text-sm font-bold text-red-700 flex items-center gap-2"
          >
            <ShieldAlert className="w-4 h-4 shrink-0 text-red-700" aria-hidden="true" />
            <span>{field.privacyWarning}</span>
          </div>
        )}

        {/* 1. Short Text */}
        {field.type === 'text' && (
          <input
            id={`field-${field.id}`}
            type="text"
            value={typeof value === 'string' ? value : ''}
            placeholder={field.placeholder || ''}
            onChange={(e) => onChange(field.id, e.target.value)}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-stone-300 bg-white text-stone-900 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-stone-800"
          />
        )}

        {/* 2. Long Text (Textarea) */}
        {field.type === 'textarea' && (
          <textarea
            id={`field-${field.id}`}
            rows={field.enableLineCountBadge ? 7 : 4}
            value={typeof value === 'string' ? value : ''}
            placeholder={field.placeholder || ''}
            onChange={(e) => onChange(field.id, e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white text-stone-900 text-sm sm:text-base leading-relaxed focus:outline-none focus:ring-2 focus:ring-stone-800"
          />
        )}

        {/* 3. Number */}
        {field.type === 'number' && (
          <input
            id={`field-${field.id}`}
            type="number"
            inputMode="numeric"
            value={typeof value === 'string' ? value : ''}
            placeholder={field.placeholder || '0'}
            onChange={(e) => onChange(field.id, e.target.value)}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-stone-300 bg-white text-stone-900 text-sm sm:text-base tabular-nums focus:outline-none focus:ring-2 focus:ring-stone-800"
          />
        )}

        {/* 4. Date */}
        {field.type === 'date' && (
          <input
            id={`field-${field.id}`}
            type="date"
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(field.id, e.target.value)}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-stone-300 bg-white text-stone-900 text-sm sm:text-base tabular-nums focus:outline-none focus:ring-2 focus:ring-stone-800"
          />
        )}

        {/* 5. Select Dropdown */}
        {field.type === 'select' && (
          <select
            id={`field-${field.id}`}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(field.id, e.target.value)}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-stone-300 bg-white text-stone-900 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-stone-800"
          >
            <option value="">— اختر من القائمة —</option>
            {(field.options ?? []).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        )}

        {/* 6. Multi-Select (Interactive Segmented Toggle Buttons + Optional Custom Option Entry) */}
        {field.type === 'multi-select' && (
          <div className="space-y-3">
            <div
              role="group"
              aria-label={field.label}
              className="flex flex-wrap gap-2.5"
            >
              {allMultiSelectOptions.map((opt) => {
                const isSelected = multiSelectArr.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() =>
                      onChange(field.id, toggleArrayOption(multiSelectArr, opt))
                    }
                    className={`min-h-[44px] px-4 py-2 rounded-xl border text-xs sm:text-sm font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-stone-900 border-stone-900 text-white'
                        : 'bg-white border-stone-300 text-stone-700 hover:bg-stone-100'
                    }`}
                  >
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    )}
                    <span>{opt}</span>
                  </button>
                );
              })}
            </div>

            {field.allowCustomOption && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                <input
                  type="text"
                  aria-label={field.customOptionPlaceholder || `إضافة خيار مخصص في ${field.label}`}
                  value={customOptionInput}
                  placeholder={
                    field.customOptionPlaceholder || 'أضف خياراً مخصصاً...'
                  }
                  onChange={(e) => setCustomOptionInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomMultiSelect();
                    }
                  }}
                  className="flex-1 min-h-[44px] px-4 py-2 rounded-xl border border-stone-300 bg-white text-stone-900 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-stone-800"
                />
                <button
                  type="button"
                  onClick={handleAddCustomMultiSelect}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-stone-300 bg-stone-100 hover:bg-stone-200 text-stone-900 text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>
                    {field.customOptionButtonLabel || 'إضافة خيار مخصص'}
                  </span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* 7. Checkboxes */}
        {field.type === 'checkbox' && (
          <div
            role="group"
            aria-label={field.label}
            className="grid grid-cols-1 sm:grid-cols-2 gap-2.5"
          >
            {(field.options ?? []).map((opt) => {
              const currentArr = Array.isArray(value)
                ? (value as string[])
                : [];
              const isChecked = currentArr.includes(opt);
              return (
                <label
                  key={opt}
                  className={`min-h-[44px] px-4 py-2.5 rounded-xl border flex items-center gap-3 cursor-pointer transition-colors ${
                    isChecked
                      ? 'bg-stone-50 border-stone-800 text-stone-950 font-semibold'
                      : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() =>
                      onChange(field.id, toggleArrayOption(currentArr, opt))
                    }
                    className="w-4 h-4 accent-stone-900 rounded shrink-0"
                  />
                  <span className="text-sm">{opt}</span>
                </label>
              );
            })}
          </div>
        )}

        {/* 8. Repeatable Fields (Independent input boxes + Optional Suggested Options + Max Rows Cap) */}
        {field.type === 'repeatable' && (
          <div className="space-y-3">
            {/* Suggested Options Bar */}
            {field.suggestedOptions && field.suggestedOptions.length > 0 && (
              <div className="rounded-xl border border-stone-200 bg-stone-50/80 p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs font-bold text-stone-700">
                  <span className="inline-flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-stone-600" aria-hidden="true" />
                    <span>خيارات مقترحة جاهزة (اضغط لإدراجها في خانة مستقلة مع إمكانية تعديلها):</span>
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {field.suggestedOptions.map((suggestion) => {
                    const alreadyUsed = repeatableArr.some(
                      (item) => item.trim() === suggestion.trim()
                    );
                    const hasEmptySlot = repeatableArr.some(
                      (item) => item.trim().length === 0
                    );
                    const canInsert =
                      !alreadyUsed && (hasEmptySlot || !isRepeatableAtMax);

                    return (
                      <button
                        key={suggestion}
                        type="button"
                        disabled={!canInsert && !alreadyUsed}
                        onClick={() => {
                          if (alreadyUsed) return;
                          onChange(
                            field.id,
                            selectSuggestedRepeatableItem(
                              repeatableArr,
                              suggestion,
                              field.maxRows
                            )
                          );
                        }}
                        className={`min-h-[38px] px-3 py-1.5 rounded-lg border text-xs font-medium text-right transition-colors cursor-pointer ${
                          alreadyUsed
                            ? 'bg-stone-900 border-stone-900 text-white'
                            : canInsert
                            ? 'bg-white border-stone-300 text-stone-800 hover:bg-stone-100'
                            : 'bg-stone-100 border-stone-200 text-stone-400 opacity-60 cursor-not-allowed'
                        }`}
                      >
                        {suggestion}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Independent Item Input Boxes */}
            <div className="space-y-2.5">
              {repeatableArr.map((item, idx, arr) => (
                <div
                  key={idx}
                  className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 rounded-xl border border-stone-200/80 bg-white p-2.5"
                >
                  <div className="flex items-center gap-2 flex-1">
                    <span className="w-8 h-10 rounded-lg bg-stone-100 text-stone-700 text-xs font-bold flex items-center justify-center shrink-0 tabular-nums">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      aria-label={`${field.repeatableItemLabel || field.label} ${idx + 1}`}
                      value={item}
                      placeholder={
                        field.placeholder ||
                        `${field.repeatableItemLabel || 'البند'} رقم ${idx + 1}`
                      }
                      onChange={(e) =>
                        onChange(
                          field.id,
                          updateRepeatableItem(arr, idx, e.target.value)
                        )
                      }
                      className="flex-1 min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-stone-800"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    {field.suggestedOptions &&
                      field.suggestedOptions.length > 0 && (
                        <select
                          aria-label={`اختيار مقترح لـ ${field.repeatableItemLabel || field.label} ${idx + 1}`}
                          value=""
                          onChange={(e) => {
                            if (!e.target.value) return;
                            onChange(
                              field.id,
                              updateRepeatableItem(arr, idx, e.target.value)
                            );
                          }}
                          className="min-h-[42px] px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 text-stone-700 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-stone-800 max-w-[180px]"
                        >
                          <option value="">اختر مقترحاً جاهزاً...</option>
                          {field.suggestedOptions.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      )}

                    <button
                      type="button"
                      aria-label={`حذف ${field.repeatableItemLabel || 'البند'} رقم ${idx + 1}`}
                      disabled={arr.length <= (field.minRows ?? 1)}
                      onClick={() =>
                        onChange(
                          field.id,
                          removeRepeatableItem(arr, idx, field.minRows ?? 1)
                        )
                      }
                      className="min-h-[42px] min-w-[42px] rounded-xl border border-stone-200 text-stone-600 hover:text-red-700 hover:bg-red-50 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={isRepeatableAtMax}
                onClick={() => {
                  onChange(
                    field.id,
                    addRepeatableItem(repeatableArr, '', field.maxRows)
                  );
                }}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-dashed border-stone-300 bg-stone-50 hover:bg-stone-100 disabled:opacity-45 disabled:pointer-events-none text-xs sm:text-sm font-semibold text-stone-800 inline-flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>
                  {field.addRowLabel ||
                    `إضافة ${field.repeatableItemLabel || 'بند جديد'}`}
                </span>
              </button>

              {isRepeatableAtMax && field.maxRows && (
                <span className="text-xs font-semibold text-[#9A4A2E] bg-[#FDF2ED] border border-[#E8C9BA] rounded-lg px-3 py-1.5">
                  تم الوصول إلى الحد الأقصى المسموح ({field.maxRows})
                </span>
              )}
            </div>
          </div>
        )}

        {/* 9. Dynamic Table (Either Card Group Mode per Program OR Standard Table Mode) */}
        {field.type === 'table' && (
          <div className="space-y-4">
            {field.displayAsCardsInForm ? (
              <div className="space-y-4">
                {(Array.isArray(value) ? (value as TableRowData[]) : []).map(
                  (row, rowIdx, rowsArr) => (
                    <div
                      key={rowIdx}
                      className="rounded-2xl border border-stone-200 bg-stone-50/60 p-4 sm:p-5 space-y-4"
                    >
                      <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                        <span className="text-sm font-bold text-stone-900">
                          {field.cardItemLabel || 'البند'} رقم ({rowIdx + 1})
                        </span>
                        <button
                          type="button"
                          aria-label={`حذف ${field.cardItemLabel || 'الصف'} رقم ${rowIdx + 1}`}
                          disabled={rowsArr.length <= (field.minRows ?? 1)}
                          onClick={() =>
                            onChange(
                              field.id,
                              removeTableRow(
                                rowsArr,
                                rowIdx,
                                field.minRows ?? 1
                              )
                            )
                          }
                          className="min-h-[38px] px-3 py-1.5 rounded-xl border border-stone-200 bg-white text-xs font-semibold text-stone-600 hover:text-red-700 hover:bg-red-50 disabled:opacity-40 disabled:pointer-events-none inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>حذف البرنامج</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                        {(field.columns ?? []).map((col) => (
                          <div key={col.key} className="space-y-1.5">
                            <label className="block text-xs font-bold text-stone-700">
                              {col.label}
                              {col.required && (
                                <span
                                  className="text-red-700 mr-1"
                                  aria-hidden="true"
                                >
                                  *
                                </span>
                              )}
                            </label>
                            {col.type === 'select' ? (
                              <select
                                aria-label={`${col.label} صف ${rowIdx + 1}`}
                                value={row[col.key] ?? ''}
                                onChange={(e) =>
                                  onChange(
                                    field.id,
                                    updateTableCell(
                                      rowsArr,
                                      rowIdx,
                                      col.key,
                                      e.target.value
                                    )
                                  )
                                }
                                className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-stone-300 bg-white text-stone-900 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-stone-800"
                              >
                                <option value="">— اختر —</option>
                                {(col.options ?? []).map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type={
                                  col.type === 'number'
                                    ? 'number'
                                    : col.type === 'date'
                                    ? 'date'
                                    : 'text'
                                }
                                aria-label={`${col.label} صف ${rowIdx + 1}`}
                                value={row[col.key] ?? ''}
                                placeholder={col.placeholder || ''}
                                onChange={(e) =>
                                  onChange(
                                    field.id,
                                    updateTableCell(
                                      rowsArr,
                                      rowIdx,
                                      col.key,
                                      e.target.value
                                    )
                                  )
                                }
                                className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-stone-300 bg-white text-stone-900 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-stone-800"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                )}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-stone-200">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-stone-100 border-b border-stone-200 text-xs sm:text-sm font-bold text-stone-800">
                      <th className="py-3 px-3 w-12 text-center">#</th>
                      {(field.columns ?? []).map((col) => (
                        <th key={col.key} className="py-3 px-3">
                          {col.label}
                          {col.required && (
                            <span
                              className="text-red-700 mr-1"
                              aria-hidden="true"
                            >
                              *
                            </span>
                          )}
                        </th>
                      ))}
                      <th className="py-3 px-3 w-16 text-center">إجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200 bg-white">
                    {(Array.isArray(value) ? (value as TableRowData[]) : []).map(
                      (row, rowIdx, rowsArr) => (
                        <tr key={rowIdx}>
                          <td className="py-2.5 px-3 text-center text-xs font-bold text-stone-500 tabular-nums">
                            {rowIdx + 1}
                          </td>
                          {(field.columns ?? []).map((col) => (
                            <td key={col.key} className="py-2 px-2">
                              {col.type === 'select' ? (
                                <select
                                  aria-label={`${col.label} صف ${rowIdx + 1}`}
                                  value={row[col.key] ?? ''}
                                  onChange={(e) =>
                                    onChange(
                                      field.id,
                                      updateTableCell(
                                        rowsArr,
                                        rowIdx,
                                        col.key,
                                        e.target.value
                                      )
                                    )
                                  }
                                  className="w-full min-h-[40px] px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-stone-900 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-stone-800"
                                >
                                  <option value="">— اختر —</option>
                                  {(col.options ?? []).map((opt) => (
                                    <option key={opt} value={opt}>
                                      {opt}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  type={
                                    col.type === 'number'
                                      ? 'number'
                                      : col.type === 'date'
                                      ? 'date'
                                      : 'text'
                                  }
                                  aria-label={`${col.label} صف ${rowIdx + 1}`}
                                  value={row[col.key] ?? ''}
                                  placeholder={col.placeholder || ''}
                                  onChange={(e) =>
                                    onChange(
                                      field.id,
                                      updateTableCell(
                                        rowsArr,
                                        rowIdx,
                                        col.key,
                                        e.target.value
                                      )
                                    )
                                  }
                                  className="w-full min-h-[40px] px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-stone-900 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-stone-800"
                                />
                              )}
                            </td>
                          ))}
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              aria-label={`حذف الصف رقم ${rowIdx + 1}`}
                              disabled={rowsArr.length <= (field.minRows ?? 1)}
                              onClick={() =>
                                onChange(
                                  field.id,
                                  removeTableRow(
                                    rowsArr,
                                    rowIdx,
                                    field.minRows ?? 1
                                  )
                                )
                              }
                              className="min-h-[40px] min-w-[40px] mx-auto rounded-lg text-stone-500 hover:text-red-700 hover:bg-red-50 disabled:opacity-35 disabled:pointer-events-none flex items-center justify-center transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" aria-hidden="true" />
                            </button>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <button
              type="button"
              disabled={Boolean(
                field.maxRows &&
                  Array.isArray(value) &&
                  value.length >= field.maxRows
              )}
              onClick={() => {
                const currentRows = Array.isArray(value)
                  ? (value as TableRowData[])
                  : [];
                onChange(
                  field.id,
                  addTableRow(field.columns ?? [], currentRows, field.maxRows)
                );
              }}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-dashed border-stone-300 bg-stone-50 hover:bg-stone-100 disabled:opacity-45 disabled:pointer-events-none text-xs sm:text-sm font-semibold text-stone-800 inline-flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>{field.addRowLabel || 'إضافة صف جديد للجدول'}</span>
            </button>
          </div>
        )}

        {/* 10. Evidence Images (In-Memory Only + Prominent Red Privacy Warning) */}
        {field.type === 'images' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-stone-300 bg-stone-50/70 p-4">
              <div className="space-y-1.5 flex-1">
                <p className="text-xs sm:text-sm font-semibold text-stone-800">
                  إرفاق الصور والشواهد (الحد الأقصى: {field.maxImages ?? 6} صور)
                </p>
                <div
                  data-testid="images-privacy-red-warning"
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs sm:text-sm font-bold text-red-700 flex items-center gap-2"
                >
                  <ShieldAlert className="w-4 h-4 shrink-0 text-red-700" aria-hidden="true" />
                  <span>
                    تُحفظ الصور في ذاكرة المتصفح المؤقتة أثناء الجلسة فقط لإدراجها في التقرير، ولا تُرفع إلى أي خادم.
                  </span>
                </div>
              </div>

              <input
                ref={fileInputRef}
                id={`field-${field.id}`}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageSelection}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={
                  Array.isArray(value) &&
                  value.length >= (field.maxImages ?? 6)
                }
                className="min-h-[44px] px-4 py-2 rounded-xl bg-white border border-stone-300 hover:bg-stone-100 text-xs sm:text-sm font-semibold text-stone-800 inline-flex items-center gap-2 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
              >
                <ImagePlus className="w-4 h-4" aria-hidden="true" />
                <span>اختيار صور الشواهد</span>
              </button>
            </div>

            {Array.isArray(value) && value.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(value as EvidenceImageItem[]).map((imgItem, idx) => (
                  <div
                    key={imgItem.id}
                    className="rounded-xl border border-stone-200 bg-white p-3 space-y-2.5"
                  >
                    <div className="relative h-44 w-full rounded-lg bg-stone-100 overflow-hidden flex items-center justify-center">
                      <img
                        src={imgItem.dataUrl}
                        alt={imgItem.caption || `شاهد رقم ${idx + 1}`}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        aria-label={`وصف الشاهد رقم ${idx + 1}`}
                        value={imgItem.caption ?? ''}
                        placeholder={`تعليق أو وصف مختصر للشاهد (${idx + 1})...`}
                        onChange={(e) =>
                          onChange(
                            field.id,
                            updateEvidenceImageCaption(
                              value as EvidenceImageItem[],
                              imgItem.id,
                              e.target.value
                            )
                          )
                        }
                        className="flex-1 min-h-[40px] px-3 py-1.5 rounded-lg border border-stone-300 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-800"
                      />
                      <button
                        type="button"
                        aria-label={`حذف الشاهد رقم ${idx + 1}`}
                        onClick={() =>
                          onChange(
                            field.id,
                            removeEvidenceImage(
                              value as EvidenceImageItem[],
                              imgItem.id
                            )
                          )
                        }
                        className="min-h-[40px] min-w-[40px] rounded-lg border border-stone-200 text-stone-600 hover:text-red-700 hover:bg-red-50 flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 11. Optional Signature Field (In-Memory Image or Blank Space in PDF) */}
        {field.type === 'signature' && (
          <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50/70 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <p className="text-xs sm:text-sm font-semibold text-stone-800">
                  إدراج صورة التوقيع (اختياري)
                </p>
                <p className="text-xs text-stone-500">
                  يمكنك رفع صورة توقيعك ليظهر في التقرير، أو تركه فارغاً للتوقيع عليه من الجوال بعد تصدير ملف PDF.
                </p>
              </div>

              <input
                ref={signatureInputRef}
                id={`field-${field.id}`}
                type="file"
                accept="image/*"
                onChange={handleSignatureSelection}
                className="hidden"
              />

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => signatureInputRef.current?.click()}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-white border border-stone-300 hover:bg-stone-100 text-xs sm:text-sm font-semibold text-stone-800 inline-flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <PenTool className="w-4 h-4" aria-hidden="true" />
                  <span>رفع صورة التوقيع</span>
                </button>

                {typeof value === 'string' && value.trim().length > 0 && (
                  <button
                    type="button"
                    onClick={() => onChange(field.id, '')}
                    className="min-h-[42px] px-3 py-2 rounded-xl border border-stone-200 bg-white text-xs font-semibold text-red-700 hover:bg-red-50 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                    <span>إزالة التوقيع</span>
                  </button>
                )}
              </div>
            </div>

            {typeof value === 'string' && value.trim().length > 0 && (
              <div className="h-24 w-48 rounded-lg border border-stone-200 bg-white p-2 flex items-center justify-center">
                <img
                  src={value}
                  alt="معاينة التوقيع المرفق"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            )}
          </div>
        )}

        {/* Field Error Message */}
        {error && (
          <p
            role="alert"
            className="mt-1.5 text-xs font-semibold text-red-700 flex items-center gap-1.5"
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </p>
        )}
      </div>
    </>
  );
};
