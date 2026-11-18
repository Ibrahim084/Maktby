import { SectionId } from './index';

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'select'
  | 'multi-select'
  | 'checkbox'
  | 'images'
  | 'table'
  | 'repeatable'
  | 'signature';

export type ReportOrientation = 'portrait' | 'landscape';

export type ExportFormat = 'pdf' | 'docx' | 'xlsx';

export type ReportTemplateLayout =
  | 'standard-report'
  | 'semester-final-report'
  | 'certificate-trainer'
  | 'certificate-trainee';

export type ReportFooterMode = 'default' | 'executor' | 'none';

export interface FieldVisibilityCondition {
  fieldId: string;
  equals: string;
}

export interface TableColumnDefinition {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'select';
  options?: string[];
  placeholder?: string;
  required?: boolean;
}

export interface EvidenceImageItem {
  id: string;
  name: string;
  dataUrl: string;
  caption?: string;
}

export interface FormFieldDefinition {
  id: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  privacyWarning?: string;
  enableLineCountBadge?: boolean;
  enableClipboardPasteButton?: boolean;
  options?: string[];
  suggestedOptions?: string[];
  allowCustomOption?: boolean;
  customOptionPlaceholder?: string;
  customOptionButtonLabel?: string;
  columns?: TableColumnDefinition[];
  displayAsCardsInForm?: boolean;
  cardItemLabel?: string;
  minRows?: number;
  maxRows?: number;
  maxImages?: number;
  repeatableItemLabel?: string;
  addRowLabel?: string;
  sectionTitle?: string;
  sectionDescription?: string;
  visibleWhen?: FieldVisibilityCondition;
  autoHijriFromFieldId?: string;
  hideInReportBody?: boolean;
  width?: 'full' | 'half';
}

export interface FormDefinition {
  id: string;
  sectionId: SectionId;
  title: string;
  description: string;
  reportTitle: string;
  orientation: ReportOrientation;
  templateLayout?: ReportTemplateLayout;
  footerMode?: ReportFooterMode;
  enableCourseSaveToLocalRegistry?: boolean;
  enableCourseRecallFromLocalRegistry?: boolean;
  enableBatchCertificateGeneration?: boolean;
  supportedExports?: ExportFormat[];
  fields: FormFieldDefinition[];
}

export type TableRowData = Record<string, string>;

export type FormFieldValue =
  | string
  | string[]
  | EvidenceImageItem[]
  | TableRowData[];

export type FormValues = Record<string, FormFieldValue>;

export type FormValidationErrors = Record<string, string>;
