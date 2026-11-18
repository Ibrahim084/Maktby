import {
  EvidenceImageItem,
  FormDefinition,
  FormFieldDefinition,
  FormValidationErrors,
  FormValues,
  TableColumnDefinition,
  TableRowData,
} from '../types/forms';

export function createEmptyTableRow(columns: TableColumnDefinition[] = []): TableRowData {
  const row: TableRowData = {};
  for (const col of columns) {
    row[col.key] = '';
  }
  return row;
}

export function createInitialFieldValue(field: FormFieldDefinition) {
  switch (field.type) {
    case 'text':
    case 'textarea':
    case 'number':
    case 'date':
    case 'select':
    case 'signature':
      return '';
    case 'multi-select':
    case 'checkbox':
      return [] as string[];
    case 'images':
      return [] as EvidenceImageItem[];
    case 'table': {
      const initialRowCount = field.minRows && field.minRows > 0 ? field.minRows : 1;
      return Array.from({ length: initialRowCount }, () =>
        createEmptyTableRow(field.columns ?? [])
      );
    }
    case 'repeatable': {
      const initialCount = field.minRows && field.minRows > 0 ? field.minRows : 1;
      return Array.from({ length: initialCount }, () => '');
    }
  }
}

export function createInitialFormValues(form: FormDefinition): FormValues {
  const values: FormValues = {};
  for (const field of form.fields) {
    values[field.id] = createInitialFieldValue(field);
  }
  return values;
}

export function isFieldVisible(field: FormFieldDefinition, values: FormValues): boolean {
  if (!field.visibleWhen) return true;
  const targetValue = values[field.visibleWhen.fieldId];
  return (
    typeof targetValue === 'string' &&
    targetValue.trim() === field.visibleWhen.equals.trim()
  );
}

/**
 * Resolves the effective display/export value of a field, substituting custom input
 * values when "أخرى" is selected (e.g., executionDomain -> customExecutionDomain).
 */
export function resolveReportFieldValue(
  field: FormFieldDefinition,
  values: FormValues
): FormValues[string] {
  const rawVal = values[field.id];
  if (field.id === 'executionDomain' && rawVal === 'أخرى') {
    const customDomain = values.customExecutionDomain;
    if (typeof customDomain === 'string' && customDomain.trim().length > 0) {
      return customDomain.trim();
    }
  }
  return rawVal;
}

/**
 * Converts a Gregorian YYYY-MM-DD date string into the corresponding
 * Umm al-Qura Hijri date string in Arabic.
 */
export function formatGregorianToUmmAlQuraHijri(gregorianDateStr: string): string {
  const trimmed = (gregorianDateStr ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return '';
  }

  const [yearStr, monthStr, dayStr] = trimmed.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return '';
  }

  const utcDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  if (Number.isNaN(utcDate.getTime())) {
    return '';
  }

  try {
    const formatter = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
    return formatter.format(utcDate);
  } catch {
    return '';
  }
}

export function isFieldPopulated(field: FormFieldDefinition, value: unknown): boolean {
  if (value === undefined || value === null) return false;

  switch (field.type) {
    case 'text':
    case 'textarea':
    case 'date':
    case 'select':
    case 'signature':
      return typeof value === 'string' && value.trim().length > 0;
    case 'number':
      if (typeof value !== 'string') return false;
      return value.trim().length > 0 && !Number.isNaN(Number(value.trim()));
    case 'multi-select':
    case 'checkbox':
      return Array.isArray(value) && value.length > 0;
    case 'images':
      return Array.isArray(value) && value.length > 0;
    case 'table': {
      if (!Array.isArray(value) || value.length === 0) return false;
      const rows = value as TableRowData[];
      const cols = field.columns ?? [];
      return rows.some((row) =>
        cols.some((col) => typeof row[col.key] === 'string' && row[col.key].trim().length > 0)
      );
    }
    case 'repeatable': {
      if (!Array.isArray(value) || value.length === 0) return false;
      return (value as string[]).some((item) => typeof item === 'string' && item.trim().length > 0);
    }
  }
}

export function isFormDirty(form: FormDefinition, values: FormValues): boolean {
  return form.fields.some(
    (field) => isFieldVisible(field, values) && isFieldPopulated(field, values[field.id])
  );
}

export function validateFormValues(
  form: FormDefinition,
  values: FormValues
): { valid: boolean; errors: FormValidationErrors } {
  const errors: FormValidationErrors = {};

  for (const field of form.fields) {
    if (!isFieldVisible(field, values)) {
      continue;
    }

    const val = values[field.id];

    if (field.type === 'number' && typeof val === 'string' && val.trim().length > 0) {
      if (Number.isNaN(Number(val.trim()))) {
        errors[field.id] = `يجب إدخال رقم صحيح في حقل «${field.label}»`;
        continue;
      }
    }

    if (!field.required) {
      continue;
    }

    switch (field.type) {
      case 'text':
      case 'textarea':
      case 'date':
      case 'select':
      case 'signature':
        if (typeof val !== 'string' || val.trim().length === 0) {
          errors[field.id] = `حقل «${field.label}» إلزامي`;
        }
        break;
      case 'number':
        if (typeof val !== 'string' || val.trim().length === 0) {
          errors[field.id] = `حقل «${field.label}» إلزامي`;
        } else if (Number.isNaN(Number(val.trim()))) {
          errors[field.id] = `يجب إدخال قيمة رقمية صحيحة في «${field.label}»`;
        }
        break;
      case 'multi-select':
      case 'checkbox':
        if (!Array.isArray(val) || val.length === 0) {
          errors[field.id] = `يرجى اختيار عنصر واحد على الأقل في «${field.label}»`;
        }
        break;
      case 'images':
        if (!Array.isArray(val) || val.length === 0) {
          errors[field.id] = `يرجى إرفاق صورة واحدة على الأقل في «${field.label}»`;
        }
        break;
      case 'table': {
        const rows = Array.isArray(val) ? (val as TableRowData[]) : [];
        const cols = field.columns ?? [];
        const hasPopulatedRow = rows.some((row) =>
          cols.some((col) => typeof row[col.key] === 'string' && row[col.key].trim().length > 0)
        );
        if (!hasPopulatedRow) {
          errors[field.id] = `يرجى تعبئة صف واحد على الأقل في «${field.label}»`;
        } else {
          const missingRequiredCol = rows.some((row) => {
            const rowHasAny = cols.some(
              (c) => typeof row[c.key] === 'string' && row[c.key].trim().length > 0
            );
            if (!rowHasAny) return false;
            return cols.some(
              (c) => c.required && (!row[c.key] || row[c.key].trim().length === 0)
            );
          });
          if (missingRequiredCol) {
            errors[field.id] = `يرجى استكمال الحقول الإلزامية في «${field.label}»`;
          }
        }
        break;
      }
      case 'repeatable': {
        const items = Array.isArray(val) ? (val as string[]) : [];
        const hasNonEmpty = items.some((item) => typeof item === 'string' && item.trim().length > 0);
        if (!hasNonEmpty) {
          errors[field.id] = `يرجى إدخال بند واحد على الأقل في «${field.label}»`;
        }
        break;
      }
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function addTableRow(
  columns: TableColumnDefinition[],
  currentRows: TableRowData[],
  maxRows?: number
): TableRowData[] {
  if (maxRows && currentRows.length >= maxRows) {
    return currentRows;
  }
  return [...currentRows, createEmptyTableRow(columns)];
}

export function removeTableRow(
  currentRows: TableRowData[],
  rowIndex: number,
  minRows = 1
): TableRowData[] {
  if (currentRows.length <= minRows) {
    return currentRows;
  }
  return currentRows.filter((_, idx) => idx !== rowIndex);
}

export function updateTableCell(
  currentRows: TableRowData[],
  rowIndex: number,
  colKey: string,
  value: string
): TableRowData[] {
  return currentRows.map((row, idx) =>
    idx === rowIndex ? { ...row, [colKey]: value } : row
  );
}

export function addRepeatableItem(
  currentItems: string[],
  defaultValue = '',
  maxRows?: number
): string[] {
  if (maxRows && currentItems.length >= maxRows) {
    return currentItems;
  }
  return [...currentItems, defaultValue];
}

export function removeRepeatableItem(
  currentItems: string[],
  index: number,
  minRows = 1
): string[] {
  if (currentItems.length <= minRows) {
    return currentItems;
  }
  return currentItems.filter((_, idx) => idx !== index);
}

export function updateRepeatableItem(
  currentItems: string[],
  index: number,
  value: string
): string[] {
  return currentItems.map((item, idx) => (idx === index ? value : item));
}

/**
 * Inserts a suggested option into the first empty slot of a repeatable field,
 * or appends a new slot if under maxRows.
 */
export function selectSuggestedRepeatableItem(
  currentItems: string[],
  suggestion: string,
  maxRows?: number
): string[] {
  const trimmed = suggestion.trim();
  if (!trimmed) return currentItems;

  if (currentItems.some((item) => item.trim() === trimmed)) {
    return currentItems;
  }

  const emptyIndex = currentItems.findIndex((item) => item.trim().length === 0);
  if (emptyIndex >= 0) {
    return updateRepeatableItem(currentItems, emptyIndex, trimmed);
  }

  if (maxRows && currentItems.length >= maxRows) {
    return currentItems;
  }

  return [...currentItems, trimmed];
}

export function toggleArrayOption(currentList: string[], option: string): string[] {
  if (currentList.includes(option)) {
    return currentList.filter((item) => item !== option);
  }
  return [...currentList, option];
}

export function addCustomMultiSelectOption(
  currentList: string[],
  customOption: string
): string[] {
  const trimmed = customOption.trim();
  if (!trimmed) return currentList;
  if (currentList.includes(trimmed)) return currentList;
  return [...currentList, trimmed];
}

export function addEvidenceImages(
  currentImages: EvidenceImageItem[],
  newImages: EvidenceImageItem[],
  maxImages = 8
): EvidenceImageItem[] {
  const combined = [...currentImages, ...newImages];
  return combined.slice(0, maxImages);
}

export function removeEvidenceImage(
  currentImages: EvidenceImageItem[],
  imageId: string
): EvidenceImageItem[] {
  return currentImages.filter((img) => img.id !== imageId);
}

export function updateEvidenceImageCaption(
  currentImages: EvidenceImageItem[],
  imageId: string,
  caption: string
): EvidenceImageItem[] {
  return currentImages.map((img) =>
    img.id === imageId ? { ...img, caption } : img
  );
}
