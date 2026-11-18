/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { ArrowRight, Settings, Users } from 'lucide-react';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { OfficialInfoBar } from './components/OfficialInfoBar';
import { PlcSectionHub } from './components/plc/PlcSectionHub';
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

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentPage(parseHashToPage(window.location.hash));
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleNavigate = (page: PageId) => {
    setCurrentPage(page);
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
      <div dir="rtl" className="min-h-screen flex flex-col bg-[#FAF8F5] text-stone-900">
        <Header currentPage={currentPage} onNavigate={handleNavigate} />

        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
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
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-white border border-stone-300 text-sm font-semibold text-stone-800 hover:bg-stone-100 transition-colors inline-flex items-center gap-2 cursor-pointer"
                >
                  <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>العودة للرئيسية</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleNavigate('settings')}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-white border border-stone-200 text-xs sm:text-sm font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-50 transition-colors inline-flex items-center gap-2 cursor-pointer"
                >
                  <Settings className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>تعديل الصفة أو بيانات المدرسة</span>
                </button>
              </div>

              <section className="bg-white rounded-2xl border border-plc-border p-6 sm:p-8 print:hidden">
                <div className="flex flex-col sm:flex-row sm:items-start gap-5">
                  <div className="w-16 h-16 rounded-2xl bg-plc text-white flex items-center justify-center shrink-0">
                    <Users className="w-8 h-8" aria-hidden="true" />
                  </div>

                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm font-semibold">
                      <span className="px-2.5 py-0.5 rounded-lg bg-plc-soft text-plc border border-plc-border">
                        قسم مستقل
                      </span>
                      <span aria-hidden="true" className="text-stone-300">
                        ·
                      </span>
                      <span className="text-plc">
                        ٩ نماذج مترابطة · الهوية التركوازية
                      </span>
                    </div>

                    <h1 className="text-2xl sm:text-3xl font-extrabold font-display text-plc">
                      مجتمعات التعلّم المهنية
                    </h1>

                    <p className="text-sm sm:text-base text-stone-600 leading-relaxed max-w-4xl">
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
    </SettingsProvider>
  );
}
