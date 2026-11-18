import React, { useState } from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, Info, RotateCcw, Save } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { DEFAULT_SCHOOL_SETTINGS } from '../data/defaultSettings';
import {
  APPROVED_SCHOOL_SEMESTERS,
  PageId,
  SchoolSettings,
  TeacherPdfColorSystem,
  TeacherPdfTemplateStyle,
  UserGender,
} from '../types';
import { getGenderedLabels, validateSchoolSettings } from '../utils/settingsStorage';
import {
  TEACHER_COLOR_PALETTES,
  TEACHER_TEMPLATE_DEFINITIONS,
} from '../utils/teacherPdfEngine';

interface SettingsPageProps {
  onNavigate: (page: PageId) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onNavigate }) => {
  const { settings, updateSettings, resetSettings } = useSettings();
  const [formData, setFormData] = useState<SchoolSettings>(() => structuredClone(settings));
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const gendered = getGenderedLabels(formData.gender);

  const handleFieldChange = (
    field: keyof Omit<SchoolSettings, 'roles'>,
    value: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    setStatusMessage(null);
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleGenderChange = (nextGender: UserGender) => {
    setFormData((prev) => ({
      ...prev,
      gender: nextGender,
    }));
    setStatusMessage(null);
  };

  const handleTeacherTemplateChange = (nextTemplate: TeacherPdfTemplateStyle) => {
    setFormData((prev) => ({
      ...prev,
      teacherPdfTemplate: nextTemplate,
    }));
    setStatusMessage(null);
  };

  const handleTeacherColorChange = (nextColor: TeacherPdfColorSystem) => {
    setFormData((prev) => ({
      ...prev,
      teacherPdfColorSystem: nextColor,
    }));
    setStatusMessage(null);
  };

  const handleRoleChange = (
    roleKey: keyof SchoolSettings['roles'],
    value: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      roles: {
        ...prev.roles,
        [roleKey]: value,
      },
    }));
    setStatusMessage(null);
    if (errors[roleKey]) {
      setErrors((prev) => ({ ...prev, [roleKey]: undefined }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateSchoolSettings(formData);
    if (!validation.valid) {
      setErrors(validation.errors);
      setStatusMessage(null);
      return;
    }

    setErrors({});
    updateSettings(formData);
    setStatusMessage('تم حفظ الإعدادات بنجاح في المتصفح المحلي.');
  };

  const handleResetDefaults = () => {
    resetSettings();
    setFormData(structuredClone(DEFAULT_SCHOOL_SETTINGS));
    setErrors({});
    setStatusMessage('تمت استعادة القيم الأولية (تفريغ الحقول) بنجاح.');
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar with Return to Home */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-white border border-stone-300 text-sm font-semibold text-stone-800 hover:bg-stone-100 transition-colors inline-flex items-center gap-2 cursor-pointer"
        >
          <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>العودة للرئيسية</span>
        </button>
      </div>

      {/* Page Heading */}
      <section className="bg-white rounded-2xl border border-stone-200/90 p-6 sm:p-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold font-display text-stone-900">
          الإعدادات المركزية
        </h1>
        <p className="mt-2 text-sm sm:text-base text-stone-600 leading-relaxed max-w-4xl">
          تُعد هذه الصفحة المصدر الموحد لبيانات المدرسة والمعلم والصفات الوظيفية التي ستظهر تلقائياً في جميع النماذج والتقارير الرسمية لاحقاً.
        </p>

        {/* Browser Local Storage Notice */}
        <div
          role="note"
          className="mt-5 rounded-xl bg-[#FAF6EE] border border-amber-200/80 p-4 flex items-start gap-3 text-xs sm:text-sm text-stone-800"
        >
          <Info className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="leading-relaxed">
            <strong>تنبيه حول الحفظ المحلي:</strong> تُحفظ هذه الإعدادات محلياً داخل متصفحك فقط دون إرسالها إلى أي خادم خارجي. يُرجى ملاحظة أن مسح بيانات المتصفح (سجل التصفح أو بيانات المواقع) قد يؤدي إلى فقدان التعديلات وعودتها إلى القيم الأولية.
          </p>
        </div>
      </section>

      {/* Settings Form */}
      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {/* Part 1: School & General Information */}
        <section className="bg-white rounded-2xl border border-stone-200/90 p-6 sm:p-8 space-y-6">
          <div className="border-b border-stone-100 pb-4">
            <h2 className="text-lg sm:text-xl font-bold font-display text-stone-900">
              أولاً: البيانات الأساسية للمدرسة والمعلم
            </h2>
            <p className="text-xs sm:text-sm text-stone-500 mt-1">
              بيانات موحدة تشترك فيها جميع أقسام النظام الثلاثة
            </p>
          </div>

          {/* Gender / Wording Mode Selection: معلم / معلمة */}
          <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-4 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="block text-sm font-bold text-stone-900">
                  الصفة العامة والصياغة اللغوية (معلم / معلمة)
                </span>
                <p className="text-xs text-stone-600 mt-0.5">
                  تتغير بناءً على هذا الاختيار الصياغة تلقائياً في الشهادات والنماذج ({gendered.honorific} · {gendered.trainerExecutedPhrase} · {gendered.traineeAttendedPhrase} · {gendered.principalTitle})
                </p>
              </div>
              <div
                role="radiogroup"
                aria-label="الصفة العامة والصياغة اللغوية"
                className="inline-flex items-center gap-2 bg-white p-1.5 rounded-xl border border-stone-200 shrink-0"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={formData.gender !== 'female'}
                  data-testid="gender-option-male"
                  onClick={() => handleGenderChange('male')}
                  className={`min-h-[40px] px-5 py-2 rounded-lg text-sm font-bold transition-colors cursor-pointer ${
                    formData.gender !== 'female'
                      ? 'bg-stone-900 text-white'
                      : 'text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  معلم
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={formData.gender === 'female'}
                  data-testid="gender-option-female"
                  onClick={() => handleGenderChange('female')}
                  className={`min-h-[40px] px-5 py-2 rounded-lg text-sm font-bold transition-colors cursor-pointer ${
                    formData.gender === 'female'
                      ? 'bg-stone-900 text-white'
                      : 'text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  معلمة
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* School Name */}
            <div>
              <label
                htmlFor="schoolName"
                className="block text-sm font-semibold text-stone-800 mb-2"
              >
                اسم المدرسة
              </label>
              <input
                id="schoolName"
                type="text"
                value={formData.schoolName}
                onChange={(e) => handleFieldChange('schoolName', e.target.value)}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-stone-300 bg-white text-stone-900 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-stone-800"
              />
              {errors.schoolName && (
                <p className="mt-1.5 text-xs text-red-700 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{errors.schoolName}</span>
                </p>
              )}
            </div>

            {/* Education Department */}
            <div>
              <label
                htmlFor="educationDepartment"
                className="block text-sm font-semibold text-stone-800 mb-2"
              >
                الإدارة التعليمية
              </label>
              <input
                id="educationDepartment"
                type="text"
                value={formData.educationDepartment}
                onChange={(e) => handleFieldChange('educationDepartment', e.target.value)}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-stone-300 bg-white text-stone-900 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-stone-800"
              />
              {errors.educationDepartment && (
                <p className="mt-1.5 text-xs text-red-700 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{errors.educationDepartment}</span>
                </p>
              )}
            </div>

            {/* User Name */}
            <div>
              <label
                htmlFor="userName"
                className="block text-sm font-semibold text-stone-800 mb-2"
              >
                اسم المستخدم
              </label>
              <input
                id="userName"
                type="text"
                value={formData.userName}
                onChange={(e) => handleFieldChange('userName', e.target.value)}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-stone-300 bg-white text-stone-900 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-stone-800"
              />
              {errors.userName && (
                <p className="mt-1.5 text-xs text-red-700 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{errors.userName}</span>
                </p>
              )}
            </div>

            {/* Principal Name */}
            <div>
              <label
                htmlFor="principalName"
                className="block text-sm font-semibold text-stone-800 mb-2"
              >
                {gendered.principalTitle}
              </label>
              <input
                id="principalName"
                type="text"
                value={formData.principalName}
                onChange={(e) => handleFieldChange('principalName', e.target.value)}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-stone-300 bg-white text-stone-900 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-stone-800"
              />
              {errors.principalName && (
                <p className="mt-1.5 text-xs text-red-700 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{errors.principalName}</span>
                </p>
              )}
            </div>

            {/* Academic Year */}
            <div>
              <label
                htmlFor="academicYear"
                className="block text-sm font-semibold text-stone-800 mb-2"
              >
                العام الدراسي
              </label>
              <input
                id="academicYear"
                type="text"
                value={formData.academicYear}
                onChange={(e) => handleFieldChange('academicYear', e.target.value)}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-stone-300 bg-white text-stone-900 text-sm sm:text-base tabular-nums focus:outline-none focus:ring-2 focus:ring-stone-800"
              />
              {errors.academicYear && (
                <p className="mt-1.5 text-xs text-red-700 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{errors.academicYear}</span>
                </p>
              )}
            </div>

            {/* Semester */}
            <div>
              <label
                htmlFor="semester"
                className="block text-sm font-semibold text-stone-800 mb-2"
              >
                الفصل الدراسي
              </label>
              <select
                id="semester"
                value={formData.semester || 'الفصل الدراسي الأول'}
                onChange={(e) => handleFieldChange('semester', e.target.value)}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-stone-300 bg-white text-stone-900 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-stone-800"
              >
                {APPROVED_SCHOOL_SEMESTERS.map((sem) => (
                  <option key={sem} value={sem}>
                    {sem}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Part 2: Independent Job Roles per Section */}
        <section className="bg-white rounded-2xl border border-stone-200/90 p-6 sm:p-8 space-y-6">
          <div className="border-b border-stone-100 pb-4">
            <h2 className="text-lg sm:text-xl font-bold font-display text-stone-900">
              ثانياً: الصفات الوظيفية المستقلة لكل قسم
            </h2>
            <p className="text-xs sm:text-sm text-stone-500 mt-1">
              كل قسم يحتفظ بصفته الوظيفية الخاصة بشكل منفصل تماماً لاستخدامها في توقيع وتوثيق نماذجه المستقلة
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Role 1: Professional Development (Maroon) */}
            <div className="rounded-xl border border-[#E6C7CF] bg-[#FAF1F3]/50 p-4">
              <label
                htmlFor="roleProfessionalDevelopment"
                className="block text-sm font-bold text-[#7C1D34] mb-1"
              >
                قسم التطوير المهني
              </label>
              <p className="text-xs text-stone-600 mb-3">
                الصفة الوظيفية المعتمدة في تقارير التطوير المهني
              </p>
              <input
                id="roleProfessionalDevelopment"
                type="text"
                value={formData.roles.professionalDevelopment}
                onChange={(e) => handleRoleChange('professionalDevelopment', e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#7C1D34]"
              />
              {errors.professionalDevelopment && (
                <p className="mt-1.5 text-xs text-red-700 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{errors.professionalDevelopment}</span>
                </p>
              )}
            </div>

            {/* Role 2: Gifted (Burgundy & Charcoal #7F1D3F / #26323B) */}
            <div className="rounded-xl border border-[#E6C7D0] bg-[#F9EFF2]/50 p-4">
              <label
                htmlFor="roleGifted"
                className="block text-sm font-bold text-[#7F1D3F] mb-1"
              >
                قسم الموهوبين
              </label>
              <p className="text-xs text-stone-600 mb-3">
                الصفة الوظيفية المعتمدة في سجل وتقارير الموهوبين
              </p>
              <input
                id="roleGifted"
                type="text"
                value={formData.roles.gifted}
                onChange={(e) => handleRoleChange('gifted', e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#7F1D3F]"
              />
              {errors.gifted && (
                <p className="mt-1.5 text-xs text-red-700 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{errors.gifted}</span>
                </p>
              )}
            </div>

            {/* Role 3: Teacher (Blue) */}
            <div className="rounded-xl border border-[#C5D7EE] bg-[#F0F5FA]/50 p-4">
              <label
                htmlFor="roleTeacher"
                className="block text-sm font-bold text-[#1E4D8C] mb-1"
              >
                قسم المعلم
              </label>
              <p className="text-xs text-stone-600 mb-3">
                الصفة الوظيفية المعتمدة في تقارير المعلم
              </p>
              <input
                id="roleTeacher"
                type="text"
                value={formData.roles.teacher}
                onChange={(e) => handleRoleChange('teacher', e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4D8C]"
              />
              {errors.teacher && (
                <p className="mt-1.5 text-xs text-red-700 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{errors.teacher}</span>
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Part 3: Teacher Section Unified PDF Template & Color System */}
        <section className="bg-white rounded-2xl border border-stone-200/90 p-6 sm:p-8 space-y-6">
          <div className="border-b border-stone-100 pb-4">
            <h2 className="text-lg sm:text-xl font-bold font-display text-stone-900">
              ثالثاً: إعدادات محرك وتقارير قسم المعلم (القالب البصري ونظام الألوان)
            </h2>
            <p className="text-xs sm:text-sm text-stone-500 mt-1">
              اختر القالب البصري والنظام اللوني المعتمد لتقارير قسم المعلم. يُطبق نظام لوني واحد مستقل لكل تقرير.
            </p>
          </div>

          {/* Visual Template Selection */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-stone-800">
              ١. القالب البصري لصفحة التقرير (ثلاثة قوالب مرجعية مستقلة - A4 طولي):
            </h3>
            <div
              role="radiogroup"
              aria-label="القالب البصري لتقارير المعلم"
              className="grid grid-cols-1 md:grid-cols-3 gap-4"
            >
              {(
                ['waves', 'waves-2', 'geometric'] as TeacherPdfTemplateStyle[]
              ).map((tplId) => {
                const tpl = TEACHER_TEMPLATE_DEFINITIONS[tplId];
                const currentTpl = formData.teacherPdfTemplate ?? 'waves';
                const isSelected = currentTpl === tplId;
                return (
                  <button
                    key={tplId}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    data-testid={`settings-teacher-template-${tplId}`}
                    onClick={() => handleTeacherTemplateChange(tplId)}
                    className={`min-h-[82px] p-4 rounded-xl border-2 text-right transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-[#15445A] bg-[#F0F6FC]/60'
                        : 'border-stone-200 bg-white hover:bg-stone-50'
                    }`}
                  >
                    <div className="text-sm font-bold text-stone-900">
                      {tpl.name}
                    </div>
                    <div className="text-xs text-stone-600 mt-1 leading-relaxed">
                      {tpl.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color System Selection */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-stone-800">
              ٢. النظام اللوني المستقل لتقارير المعلم:
            </h3>
            <div
              role="radiogroup"
              aria-label="النظام اللوني لتقارير المعلم"
              className="grid grid-cols-1 md:grid-cols-3 gap-4"
            >
              {(
                ['green', 'blue', 'slate'] as TeacherPdfColorSystem[]
              ).map((sysId) => {
                const sys = TEACHER_COLOR_PALETTES[sysId];
                const isSelected =
                  (formData.teacherPdfColorSystem ?? 'green') === sysId;
                return (
                  <button
                    key={sysId}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    data-testid={`settings-teacher-color-${sysId}`}
                    onClick={() => handleTeacherColorChange(sysId)}
                    className={`min-h-[70px] p-4 rounded-xl border-2 text-right flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-[#15445A] bg-stone-50'
                        : 'border-stone-200 bg-white hover:bg-stone-50'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="text-sm font-bold text-stone-900">
                        {sys.name}
                      </div>
                      <div className="text-xs text-stone-600 leading-relaxed">
                        {sys.description}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <span
                        className="w-7 h-3.5 rounded-sm border border-black/10"
                        style={{ backgroundColor: sys.primaryHex }}
                      />
                      <span
                        className="w-7 h-3.5 rounded-sm border border-black/10"
                        style={{ backgroundColor: sys.secondaryHex }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Status Feedback Banner */}
        {statusMessage && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-xl bg-[#EFF8F3] border border-[#C2E2D2] p-4 flex items-center gap-3 text-sm font-semibold text-[#156B46]"
          >
            <CheckCircle2 className="w-5 h-5 shrink-0" aria-hidden="true" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Form Actions */}
        <div className="bg-white rounded-2xl border border-stone-200/90 p-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <button
            type="submit"
            className="min-h-[48px] px-6 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>حفظ الإعدادات</span>
          </button>

          <button
            type="button"
            onClick={handleResetDefaults}
            className="min-h-[48px] px-5 py-2.5 rounded-xl border border-stone-300 hover:bg-stone-100 text-stone-700 text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>استعادة القيم الأولية</span>
          </button>
        </div>
      </form>
    </div>
  );
};
