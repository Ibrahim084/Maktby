import React from 'react';
import {
  ArrowRight,
  Edit3,
  Eye,
  FileSpreadsheet,
  FileText,
  Printer,
  RotateCcw,
} from 'lucide-react';
import { ExportFormat } from '../../types/forms';

interface FormActionsProps {
  isPreviewMode: boolean;
  supportedExports?: ExportFormat[];
  accentButtonClass?: string;
  onTogglePreview: () => void;
  onExport: (format: ExportFormat) => void;
  onResetRequest: () => void;
  onBackRequest: () => void;
}

export const FormActions: React.FC<FormActionsProps> = ({
  isPreviewMode,
  supportedExports = ['pdf', 'docx', 'xlsx'],
  accentButtonClass = 'bg-stone-900 hover:bg-stone-800 text-white',
  onTogglePreview,
  onExport,
  onResetRequest,
  onBackRequest,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-stone-200/90 p-4 sm:p-5 print:hidden">
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Primary Preview & Export Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onTogglePreview}
            className={`min-h-[44px] px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer ${accentButtonClass}`}
          >
            {isPreviewMode ? (
              <>
                <Edit3 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>العودة لتحرير النموذج</span>
              </>
            ) : (
              <>
                <Eye className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>معاينة التقرير</span>
              </>
            )}
          </button>

          {supportedExports.includes('pdf') && (
            <button
              type="button"
              onClick={() => onExport('pdf')}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>طباعة / PDF (A4)</span>
            </button>
          )}

          {supportedExports.includes('docx') && (
            <button
              type="button"
              onClick={() => onExport('docx')}
              className="min-h-[44px] px-4 py-2.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-100 text-stone-800 text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <FileText className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>تصدير DOCX</span>
            </button>
          )}

          {supportedExports.includes('xlsx') && (
            <button
              type="button"
              onClick={() => onExport('xlsx')}
              className="min-h-[44px] px-4 py-2.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-100 text-stone-800 text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>تصدير XLSX</span>
            </button>
          )}
        </div>

        {/* Secondary Reset & Return Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onResetRequest}
            className="min-h-[44px] px-4 py-2.5 rounded-xl border border-stone-300 bg-white hover:bg-red-50 hover:border-red-200 hover:text-red-800 text-stone-700 text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>مسح بيانات النموذج</span>
          </button>

          <button
            type="button"
            onClick={onBackRequest}
            className="min-h-[44px] px-4 py-2.5 rounded-xl border border-stone-300 bg-stone-50 hover:bg-stone-100 text-stone-800 text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>العودة للقسم</span>
          </button>
        </div>
      </div>
    </div>
  );
};
