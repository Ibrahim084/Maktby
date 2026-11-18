import { SectionId } from '../types';
import { FormDefinition } from '../types/forms';
import { PROFESSIONAL_DEVELOPMENT_FORMS } from './professionalDevelopmentForms';

/**
 * Independent form registries for the three sections.
 * Professional Development contains its 4 approved forms; Gifted and Teacher remain independent.
 */
const SECTION_FORMS_REGISTRY: Record<SectionId, FormDefinition[]> = {
  'professional-development': [...PROFESSIONAL_DEVELOPMENT_FORMS],
  gifted: [],
  teacher: [],
};

export function getFormsForSection(sectionId: SectionId): FormDefinition[] {
  return SECTION_FORMS_REGISTRY[sectionId] ?? [];
}

export function registerSectionForm(form: FormDefinition): void {
  const list = SECTION_FORMS_REGISTRY[form.sectionId];
  const existingIdx = list.findIndex((item) => item.id === form.id);
  if (existingIdx >= 0) {
    list[existingIdx] = form;
  } else {
    list.push(form);
  }
}

/**
 * Built-in diagnostic schema that exercises all supported field types
 * so the unified forms & reports engine can be verified in any section.
 */
export function createEngineVerificationForm(
  sectionId: SectionId,
  sectionTitle: string
): FormDefinition {
  return {
    id: `engine-verification-${sectionId}`,
    sectionId,
    title: `نموذج فحص المحرك الموحد — ${sectionTitle}`,
    description:
      'نموذج معياري لاختبار جميع أنواع الحقول العشرة، التحقق من الحقول الإلزامية، الجداول الديناميكية، الشواهد المصورة، ومعاينة قالب التقرير المطبوع (A4 RTL).',
    reportTitle: `تقرير توثيقي موحد — قسم ${sectionTitle}`,
    orientation: 'portrait',
    supportedExports: ['pdf', 'docx', 'xlsx'],
    fields: [
      {
        id: 'programTitle',
        label: 'عنوان البرنامج أو النشاط',
        type: 'text',
        required: true,
        placeholder: 'أدخل عنوان البرنامج أو المهمة...',
        width: 'half',
      },
      {
        id: 'executionDate',
        label: 'تاريخ التنفيذ',
        type: 'date',
        required: true,
        width: 'half',
      },
      {
        id: 'beneficiariesCount',
        label: 'عدد المستفيدين',
        type: 'number',
        required: true,
        placeholder: 'مثال: 25',
        width: 'half',
      },
      {
        id: 'executionDomain',
        label: 'مجال التنفيذ',
        type: 'select',
        required: true,
        options: ['تطوير الأداء', 'برامج إثرائية', 'مبادرة مدرسية', 'متابعة وتقويم'],
        width: 'half',
      },
      {
        id: 'targetGroups',
        label: 'الفئات المستهدفة (اختيار متعدد)',
        type: 'multi-select',
        required: true,
        options: ['الهيئة التعليمية', 'الهيئة الإدارية', 'اللجان المدرسية', 'المجتمع المدرسي'],
        width: 'full',
      },
      {
        id: 'documentationTools',
        label: 'وسائل التوثيق المستخدمة (مربعات اختيار)',
        type: 'checkbox',
        required: false,
        options: ['سجل الحضور', 'عروض تقديمية', 'شواهد مصورة', 'نماذج تقويم'],
        width: 'full',
      },
      {
        id: 'summaryDescription',
        label: 'ملخص التنفيذ والإجراءات',
        type: 'textarea',
        required: true,
        placeholder: 'اكتب وصفاً تفصيلياً للإجراءات المنفذة...',
        width: 'full',
      },
      {
        id: 'objectivesList',
        label: 'الأهداف والتوصيات (حقول قابلة للتكرار)',
        type: 'repeatable',
        required: true,
        repeatableItemLabel: 'هدف / توصية',
        placeholder: 'أدخل الهدف أو التوصية...',
        minRows: 1,
        maxRows: 10,
        width: 'full',
      },
      {
        id: 'scheduleTable',
        label: 'جدول متابعة المهام والأنشطة (قابل لإضافة وحذف الصفوف)',
        type: 'table',
        required: true,
        minRows: 1,
        maxRows: 15,
        columns: [
          { key: 'taskName', label: 'المهمة / البند', type: 'text', required: true, placeholder: 'اسم المهمة' },
          { key: 'duration', label: 'المدة (بالساعات)', type: 'number', required: false, placeholder: '2' },
          { key: 'status', label: 'حالة الإنجاز', type: 'select', options: ['مكتمل', 'قيد التنفيذ', 'مجدول'], required: true },
        ],
        width: 'full',
      },
      {
        id: 'evidencePhotos',
        label: 'الشواهد المصورة (تبقى في ذاكرة المتصفح المؤقتة فقط)',
        type: 'images',
        required: false,
        maxImages: 4,
        helpText: 'يمكنك اختيار صورة أو أكثر لمعاينتها وإدراجها في التقرير دون حفظها في المتصفح أو رفعها لأي خادم.',
        width: 'full',
      },
    ],
  };
}
