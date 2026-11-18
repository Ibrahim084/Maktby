import React from 'react';
import { SchoolSettings } from '../../types';
import { FormDefinition, FormValues } from '../../types/forms';
import { ReportTemplate } from './ReportTemplate';

interface ReportPreviewProps {
  form: FormDefinition;
  values: FormValues;
  settings: SchoolSettings;
}

export const ReportPreview: React.FC<ReportPreviewProps> = ({
  form,
  values,
  settings,
}) => {
  return (
    <section
      aria-label="معاينة التقرير قبل التصدير"
      className="space-y-4"
    >
      <div className="overflow-x-auto pb-2">
        <ReportTemplate form={form} values={values} settings={settings} />
      </div>
    </section>
  );
};
