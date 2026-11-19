import React from 'react';
import { useSettings } from '../context/SettingsContext';

export const Footer: React.FC = () => {
  const { settings } = useSettings();

  return (
    <footer className="bg-white border-t border-[#E2E5E6] mt-auto print:hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#626D72]">
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-2 gap-y-1">
          <span className="font-bold font-display text-[#292F33]">مكتبي</span>
          <span aria-hidden="true" className="text-[#9AA5AA]">·</span>
          <span>شريكك في تنظيم وإنجاز أعمالك المدرسية</span>
          {settings.schoolName && (
            <>
              <span aria-hidden="true" className="text-[#9AA5AA]">·</span>
              <span className="text-[#292F33] font-medium">{settings.schoolName}</span>
            </>
          )}
          {settings.academicYear && (
            <>
              <span aria-hidden="true" className="text-[#9AA5AA]">·</span>
              <span className="tabular-nums text-[#626D72]">
                العام الدراسي {settings.academicYear}
              </span>
            </>
          )}
        </div>
        <p className="text-center sm:text-left text-[#626D72]">
          يعمل النظام محلياً داخل متصفحك دون إرسال أي بيانات إلى خادم خارجي
        </p>
      </div>
    </footer>
  );
};
