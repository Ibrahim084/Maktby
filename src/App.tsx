/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import {
  ArrowRightLineIcon,
  PlcLineIcon,
  SettingsLineIcon,
} from './components/brand/MaktbyIcons';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { OfficialInfoBar } from './components/OfficialInfoBar';
import { PlcSectionHub } from './components/plc/PlcSectionHub';
import { Sidebar } from './components/Sidebar';
import { SettingsProvider } from './context/SettingsContext';
import { GiftedPage } from './pages/GiftedPage';
import { HomePage } from './pages/HomePage';
import { ProfessionalDevelopmentPage } from './pages/ProfessionalDevelopmentPage';
import { SettingsPage } from './pages/SettingsPage';
import { TeacherPage } from './pages/TeacherPage';
import { PageId } from './types';
import { pageToHash, parseHashToPage } from './utils/settingsStorage';

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageId>(() =>
    typeof window !== 'undefined' ? parseHashToPage(window.location.hash) : 'home'
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentPage(parseHashToPage(window.location.hash));
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleNavigate = (page: PageId) => {
    setCurrentPage(page);
    setMobileMenuOpen(false);
    if (typeof window !== 'undefined') {
      const targetHash = pageToHash(page);
      if (window.location.hash !== targetHash) {
        window.history.pushState(null, '', targetHash);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <SettingsProvider>
      <div dir="rtl" className="min-h-screen flex bg-[#F9F8F5] text-[#292F33]">
        <Sidebar
          currentPage={currentPage}
          onNavigate={handleNavigate}
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
        />

        <div className="flex-1 min-w-0 flex flex-col min-h-screen">
          <Header
            currentPage={currentPage}
            onNavigate={handleNavigate}
            onOpenMobileMenu={() => setMobileMenuOpen(true)}
          />

          <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            {currentPage === 'home' && <HomePage onNavigate={handleNavigate} />}
            {currentPage === 'professional-development' && (
              <ProfessionalDevelopmentPage onNavigate={handleNavigate} />
            )}
            {currentPage === 'plc' && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
                  <button
                    type="button"
                    onClick={() => handleNavigate('home')}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-white border border-[#E2E5E6] text-sm font-semibold text-[#292F33] hover:bg-[#EAF2F1] hover:border-[#C4D8D6] hover:text-[#315E62] transition-colors inline-flex items-center gap-2 cursor-pointer"
                  >
                    <ArrowRightLineIcon className="w-4 h-4 shrink-0 text-[#376B70]" />
                    <span>العودة للرئيسية</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleNavigate('settings')}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-[#EAF2F1] border border-[#C4D8D6] text-xs sm:text-sm font-semibold text-[#315E62] hover:bg-[#DCE9E8] transition-colors inline-flex items-center gap-2 cursor-pointer"
                  >
                    <SettingsLineIcon className="w-4 h-4 shrink-0" />
                    <span>تعديل الصفة أو بيانات المدرسة</span>
                  </button>
                </div>

                <section className="bg-white rounded-2xl border border-[#E2E5E6] p-6 sm:p-8 print:hidden">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-5">
                    <div className="w-16 h-16 rounded-2xl bg-[#E5E9E7] border border-[#C5D0CA] text-[#60776B] flex items-center justify-center shrink-0">
                      <PlcLineIcon className="w-8 h-8" />
                    </div>

                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm font-medium text-[#626D72]">
                        <span className="font-semibold text-[#495D53]">قسم مستقل</span>
                        <span aria-hidden="true" className="text-[#9AA5AA]">
                          ·
                        </span>
                        <span>٩ نماذج مترابطة</span>
                      </div>

                      <h1 className="text-2xl sm:text-3xl font-extrabold font-display text-[#292F33]">
                        مجتمعات التعلّم المهنية
                      </h1>

                      <p className="text-sm sm:text-base text-[#626D72] leading-relaxed max-w-4xl">
                        مساحة مخصصة لإدارة وتوثيق مجتمعات التعلّم المهنية داخل المدرسة، ومتابعة خططها واجتماعاتها وبرامجها ومؤشراتها وقياس أثرها وإصدار تقريرها الختامي.
                      </p>
                    </div>
                  </div>
                </section>

                <div className="print:hidden">
                  <OfficialInfoBar />
                </div>

                <PlcSectionHub />
              </div>
            )}
            {currentPage === 'gifted' && <GiftedPage onNavigate={handleNavigate} />}
            {currentPage === 'teacher' && <TeacherPage onNavigate={handleNavigate} />}
            {currentPage === 'settings' && <SettingsPage onNavigate={handleNavigate} />}
          </main>

          <Footer />
        </div>
      </div>
    </SettingsProvider>
  );
}
