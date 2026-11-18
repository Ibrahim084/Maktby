import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  Columns3,
  Eye,
  FileDown,
  ImagePlus,
  Layers,
  Link2,
  Palette,
  Plus,
  RefreshCw,
  Sliders,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import {
  TeacherPdfColorSystem,
  TeacherPdfTemplateStyle,
} from '../../types';
import {
  createDefaultSampleEvidencePhotos,
  createSampleTeacherReportDocument,
  generateQrSvgDataUrl,
  generateTeacherReportPdf,
  getTeacherColorPalette,
  paginateTeacherReportBlocks,
  renderTeacherReportPagesToCanvases,
  TEACHER_COLOR_PALETTES,
  TEACHER_TEMPLATE_DEFINITIONS,
  TeacherPageJpegWithLinks,
  TeacherReportDocument,
  TeacherReportEvidenceLink,
  TeacherReportEvidencePhoto,
} from '../../utils/teacherPdfEngine';

const ALL_TEMPLATES: TeacherPdfTemplateStyle[] = [
  'waves',
  'waves-2',
  'geometric',
];

const ALL_COLOR_SYSTEMS: TeacherPdfColorSystem[] = ['green', 'blue', 'slate'];

const DEFAULT_LINK_1 = 'https://moe.gov.sa/ar/education/Pages/default.aspx';
const DEFAULT_LINK_2 = 'https://ien.edu.sa/';

function readImageFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Invalid file data'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

export const TeacherPdfMasterPreview: React.FC = () => {
  const { settings, updateSettings } = useSettings();

  const templateStyle: TeacherPdfTemplateStyle =
    settings.teacherPdfTemplate === 'geometric' ||
    settings.teacherPdfTemplate === 'waves-2'
      ? settings.teacherPdfTemplate
      : 'waves';

  const colorSystem: TeacherPdfColorSystem =
    settings.teacherPdfColorSystem === 'blue' ||
    settings.teacherPdfColorSystem === 'slate'
      ? settings.teacherPdfColorSystem
      : 'green';

  const [viewMode, setViewMode] = useState<'single' | 'compare'>('single');
  const [contentMode, setContentMode] = useState<'short' | 'multi-page'>(
    'short'
  );

  // Independent Photos State (0, 1, or 2 uploaded/sample photos)
  const [evidencePhotos, setEvidencePhotos] = useState<
    TeacherReportEvidencePhoto[]
  >(() => createDefaultSampleEvidencePhotos(colorSystem));

  // Track whether current photos are default samples so color changes refresh sample SVGs without overwriting user-uploaded files
  const [hasCustomUploadedPhotos, setHasCustomUploadedPhotos] =
    useState<boolean>(false);

  // Independent Electronic Links State (0, 1, or 2 URLs)
  const [evidenceLinks, setEvidenceLinks] = useState<
    TeacherReportEvidenceLink[]
  >([
    { id: 'link-1', url: DEFAULT_LINK_1 },
    { id: 'link-2', url: DEFAULT_LINK_2 },
  ]);

  const [includeExecutor, setIncludeExecutor] = useState<boolean>(false);
  const [includeNationalId, setIncludeNationalId] = useState<boolean>(false);
  const [includeSignature, setIncludeSignature] = useState<boolean>(false);
  const [includePrincipal, setIncludePrincipal] = useState<boolean>(true);

  const [customReportTypeLabel, setCustomReportTypeLabel] = useState<string>(
    'تقرير تنفيذ برنامج'
  );

  const [renderedPages, setRenderedPages] = useState<
    TeacherPageJpegWithLinks[]
  >([]);
  const [comparisonPagesMap, setComparisonPagesMap] = useState<
    Partial<Record<TeacherPdfTemplateStyle, TeacherPageJpegWithLinks>>
  >({});

  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  const addPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const replacePhotoInputRefs = useRef<Record<number, HTMLInputElement | null>>(
    {}
  );

  // Keep default sample SVG photos in sync with the active color system if the user hasn't uploaded custom files
  useEffect(() => {
    if (!hasCustomUploadedPhotos) {
      const nextSamples = createDefaultSampleEvidencePhotos(colorSystem);
      setEvidencePhotos((prev) =>
        prev.map((item, idx) => ({
          ...item,
          imageDataUrl:
            nextSamples[idx]?.imageDataUrl ?? nextSamples[0].imageDataUrl,
        }))
      );
    }
  }, [colorSystem, hasCustomUploadedPhotos]);

  const handleSelectTemplate = (nextTemplate: TeacherPdfTemplateStyle) => {
    updateSettings({
      ...settings,
      teacherPdfTemplate: nextTemplate,
    });
    setExportStatus(null);
  };

  const handleSelectColorSystem = (nextColor: TeacherPdfColorSystem) => {
    updateSettings({
      ...settings,
      teacherPdfColorSystem: nextColor,
    });
    setExportStatus(null);
  };

  // Photo Handlers (Upload, Replace, Delete, Quick Presets)
  const handleSetPhotoPresetCount = (count: 0 | 1 | 2) => {
    const samples = createDefaultSampleEvidencePhotos(colorSystem);
    if (count === 0) {
      setEvidencePhotos([]);
    } else if (count === 1) {
      setEvidencePhotos((prev) =>
        prev.length >= 1 ? [prev[0]] : [samples[0]]
      );
    } else {
      setEvidencePhotos((prev) => {
        if (prev.length === 2) return prev;
        if (prev.length === 1) return [prev[0], samples[1]];
        return [samples[0], samples[1]];
      });
    }
    setExportStatus(null);
  };

  const handleUploadNewPhotos = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    try {
      const remainingSlots = Math.max(0, 2 - evidencePhotos.length);
      const filesToRead = files.slice(0, Math.max(1, remainingSlots));
      const dataUrls = await Promise.all(filesToRead.map(readImageFileAsDataUrl));

      setHasCustomUploadedPhotos(true);
      setEvidencePhotos((prev) => {
        const combined = [
          ...prev,
          ...dataUrls.map((url, idx) => ({
            id: `photo-${Date.now()}-${idx + 1}`,
            imageDataUrl: url,
          })),
        ];
        return combined.slice(0, 2);
      });
      setExportStatus(null);
    } catch {
      // Ignore invalid image read
    } finally {
      e.target.value = '';
    }
  };

  const handleReplacePhotoAt = async (
    index: number,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await readImageFileAsDataUrl(file);
      setHasCustomUploadedPhotos(true);
      setEvidencePhotos((prev) =>
        prev.map((p, idx) =>
          idx === index
            ? {
                id: `photo-replaced-${Date.now()}-${index + 1}`,
                imageDataUrl: dataUrl,
              }
            : p
        )
      );
      setExportStatus(null);
    } catch {
      // Ignore invalid image read
    } finally {
      e.target.value = '';
    }
  };

  const handleDeletePhotoAt = (index: number) => {
    setEvidencePhotos((prev) => prev.filter((_, idx) => idx !== index));
    setExportStatus(null);
  };

  // Electronic Links Handlers (Add, Edit, Delete, Quick Presets)
  const handleSetLinkPresetCount = (count: 0 | 1 | 2) => {
    if (count === 0) {
      setEvidenceLinks([]);
    } else if (count === 1) {
      setEvidenceLinks((prev) =>
        prev.length >= 1
          ? [prev[0]]
          : [{ id: 'link-1', url: DEFAULT_LINK_1 }]
      );
    } else {
      setEvidenceLinks((prev) => {
        if (prev.length === 2) return prev;
        if (prev.length === 1) {
          return [prev[0], { id: 'link-2', url: DEFAULT_LINK_2 }];
        }
        return [
          { id: 'link-1', url: DEFAULT_LINK_1 },
          { id: 'link-2', url: DEFAULT_LINK_2 },
        ];
      });
    }
    setExportStatus(null);
  };

  const handleAddLink = () => {
    setEvidenceLinks((prev) => {
      if (prev.length >= 2) return prev;
      const defaultUrl = prev.length === 0 ? DEFAULT_LINK_1 : DEFAULT_LINK_2;
      return [
        ...prev,
        { id: `link-${Date.now()}-${prev.length + 1}`, url: defaultUrl },
      ];
    });
    setExportStatus(null);
  };

  const handleUpdateLinkAt = (index: number, nextUrl: string) => {
    setEvidenceLinks((prev) =>
      prev.map((item, idx) =>
        idx === index ? { ...item, url: nextUrl } : item
      )
    );
    setExportStatus(null);
  };

  const handleDeleteLinkAt = (index: number) => {
    setEvidenceLinks((prev) => prev.filter((_, idx) => idx !== index));
    setExportStatus(null);
  };

  const buildDocForTemplate = (
    tpl: TeacherPdfTemplateStyle,
    col: TeacherPdfColorSystem
  ): TeacherReportDocument => {
    const activeLinks = evidenceLinks.filter(
      (l) => Boolean(l.url && l.url.trim())
    );
    const resolvedSettingsPrincipal =
      settings.principalName?.trim() || 'أ. أحمد العتيبي';
    const base = createSampleTeacherReportDocument({
      templateStyle: tpl,
      colorSystem: col,
      mode: contentMode,
      evidencePhotos,
      evidenceLinks: activeLinks,
      includeExecutor,
      includeNationalId,
      includeSignature,
      schoolYear: settings.academicYear,
      teacherName: settings.userName,
      principalName: includePrincipal ? resolvedSettingsPrincipal : '',
    });

    return {
      ...base,
      includePrincipalSignoff:
        includePrincipal && Boolean(resolvedSettingsPrincipal),
      reportTypeLabel: customReportTypeLabel.trim() || 'تقرير تنفيذ برنامج',
    };
  };

  const reportDoc: TeacherReportDocument = useMemo(
    () => buildDocForTemplate(templateStyle, colorSystem),
    [
      templateStyle,
      colorSystem,
      contentMode,
      evidencePhotos,
      evidenceLinks,
      includeExecutor,
      includeNationalId,
      includeSignature,
      includePrincipal,
      settings.academicYear,
      settings.userName,
      settings.principalName,
      customReportTypeLabel,
    ]
  );

  const palette = getTeacherColorPalette(colorSystem);
  const activeTemplateDef = TEACHER_TEMPLATE_DEFINITIONS[templateStyle];

  const paginatedPages = useMemo(
    () => paginateTeacherReportBlocks(reportDoc, settings),
    [reportDoc, settings]
  );

  // Render live high-DPI canvas pages for the currently selected template
  useEffect(() => {
    let cancelled = false;
    renderTeacherReportPagesToCanvases(reportDoc, settings)
      .then((pages) => {
        if (!cancelled) {
          setRenderedPages(pages);
        }
      })
      .catch(() => {
        // Ignore transient canvas errors
      });
    return () => {
      cancelled = true;
    };
  }, [reportDoc, settings]);

  // Render all 3 templates side-by-side when in Comparison Mode (or pre-render for fast switching)
  useEffect(() => {
    let cancelled = false;
    const renderAllThree = async () => {
      const nextMap: Partial<
        Record<TeacherPdfTemplateStyle, TeacherPageJpegWithLinks>
      > = {};
      for (const tpl of ALL_TEMPLATES) {
        const docForTpl = buildDocForTemplate(tpl, colorSystem);
        const pages = await renderTeacherReportPagesToCanvases(
          docForTpl,
          settings
        );
        if (pages[0]) {
          nextMap[tpl] = pages[0];
        }
      }
      if (!cancelled) {
        setComparisonPagesMap(nextMap);
      }
    };
    renderAllThree().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [
    colorSystem,
    contentMode,
    evidencePhotos,
    evidenceLinks,
    includeExecutor,
    includeNationalId,
    includeSignature,
    includePrincipal,
    settings,
    customReportTypeLabel,
  ]);

  const handleExportPdf = async (
    overrideTemplate?: TeacherPdfTemplateStyle
  ) => {
    try {
      setIsExporting(true);
      setExportStatus(null);
      const targetDoc = overrideTemplate
        ? buildDocForTemplate(overrideTemplate, colorSystem)
        : reportDoc;
      const result = await generateTeacherReportPdf(targetDoc, settings);
      const blob = new Blob([new Uint8Array(result.pdfBytes)], {
        type: 'application/pdf',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 5000);

      const tplName =
        TEACHER_TEMPLATE_DEFINITIONS[targetDoc.templateStyle].name;
      const activePhotosLen = (targetDoc.evidencePhotos || []).length;
      setExportStatus(
        `تم تصدير ملف PDF بنجاح (${tplName} · ${palette.name} · ${result.pageCount} ${
          result.pageCount === 1 ? 'صفحة' : 'صفحات'
        } · ${activePhotosLen} صور شواهد · ${result.linkAnnotationsCount} رابط QR تفاعلي قابل للنقر).`
      );
    } catch {
      setExportStatus('حدث خطأ غير متوقع أثناء توليد ملف PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  const activeValidLinksCount = evidenceLinks.filter((l) =>
    Boolean(l.url && l.url.trim())
  ).length;

  return (
    <div
      className="space-y-6"
      data-testid="teacher-pdf-engine-studio"
      data-photo-count={evidencePhotos.length}
      data-link-count={activeValidLinksCount}
      data-page-count={paginatedPages.length}
    >
      {/* Studio Control Bar */}
      <section className="bg-white rounded-2xl border border-stone-200/90 p-6 sm:p-8 space-y-6 print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-stone-100 pb-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-[#1E4D8C]">
              <Sliders className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>محرك الهوية البصرية ونظام الشواهد الموحد — قسم المعلم</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold font-display text-stone-900">
              معاينة القوالب البصرية الثلاثة ونظام الشواهد المستقل (الصور + روابط QR)
            </h2>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed max-w-3xl">
              تحكم بشكل مستقل تمامًا في رفع صور الشواهد (حتى صورتين بصيغ JPG / PNG / WebP مع المعاينة والاستبدال والحذف) وإدخال الروابط الإلكترونية (حتى رابطين يتحولان تلقائيًا إلى رموز QR قابلة للمسح والنقر المباشر داخل ملف PDF).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              data-testid="teacher-toggle-compare-mode"
              onClick={() =>
                setViewMode((prev) =>
                  prev === 'single' ? 'compare' : 'single'
                )
              }
              className={`min-h-[48px] px-4 py-2.5 rounded-xl border text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                viewMode === 'compare'
                  ? 'border-[#15445A] bg-[#F0F6FC] text-[#15445A]'
                  : 'border-stone-300 bg-white text-stone-800 hover:bg-stone-50'
              }`}
            >
              <Columns3 className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>
                {viewMode === 'compare'
                  ? 'العودة للمعاينة المفردة (A4)'
                  : 'مقارنة القوالب الثلاثة جنباً إلى جنب'}
              </span>
            </button>

            <button
              type="button"
              data-testid="teacher-export-pdf-btn"
              disabled={isExporting}
              onClick={() => handleExportPdf()}
              className="min-h-[48px] px-5 py-2.5 rounded-xl text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
              style={{ backgroundColor: palette.secondaryHex }}
            >
              <FileDown className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>
                {isExporting
                  ? 'جاري توليد ملف PDF...'
                  : 'تصدير وتحميل ملف PDF (A4)'}
              </span>
            </button>
          </div>
        </div>

        {exportStatus && (
          <div
            role="status"
            data-testid="teacher-export-status"
            className="rounded-xl border border-[#B2E4CE] bg-[#ECFDF5] px-4 py-3 flex items-center gap-2.5 text-xs sm:text-sm font-bold text-[#15445A]"
          >
            <CheckCircle2
              className="w-4 h-4 shrink-0 text-[#07A869]"
              aria-hidden="true"
            />
            <span>{exportStatus}</span>
          </div>
        )}

        {/* Controls Grid: Templates, Colors, Content Length */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* 1. Three Reference Visual Templates Selector */}
          <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <Sparkles
                  className="w-4 h-4 text-[#1E4D8C]"
                  aria-hidden="true"
                />
                <span>١. القالب البصري (٣ قوالب)</span>
              </span>
            </div>

            <div
              role="radiogroup"
              aria-label="القالب البصري لتقارير المعلم"
              className="grid grid-cols-1 sm:grid-cols-3 gap-2"
            >
              {ALL_TEMPLATES.map((tplId) => {
                const tpl = TEACHER_TEMPLATE_DEFINITIONS[tplId];
                const isSelected = templateStyle === tplId;
                return (
                  <button
                    key={tplId}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    data-testid={`teacher-template-${tplId}`}
                    onClick={() => handleSelectTemplate(tplId)}
                    className={`min-h-[58px] px-2.5 py-2 rounded-xl border text-right transition-colors cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-[#15445A] bg-white text-stone-950 font-bold shadow-2xs'
                        : 'border-stone-200 bg-white/70 text-stone-700 hover:bg-white'
                    }`}
                  >
                    <div className="text-xs font-bold">{tpl.name}</div>
                    {tpl.shortName !== tpl.name && (
                      <div className="text-[10px] text-stone-500 line-clamp-1 mt-0.5">
                        {tpl.shortName}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Three Color Systems Selector */}
          <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <Palette
                  className="w-4 h-4 text-[#1E4D8C]"
                  aria-hidden="true"
                />
                <span>٢. نظام الألوان</span>
              </span>
            </div>

            <div
              role="radiogroup"
              aria-label="النظام اللوني لتقارير المعلم"
              className="grid grid-cols-1 sm:grid-cols-3 gap-2"
            >
              {ALL_COLOR_SYSTEMS.map((sysId) => {
                const sys = TEACHER_COLOR_PALETTES[sysId];
                const isSelected = colorSystem === sysId;
                return (
                  <button
                    key={sysId}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    data-testid={`teacher-color-${sysId}`}
                    onClick={() => handleSelectColorSystem(sysId)}
                    className={`min-h-[58px] px-2.5 py-2 rounded-xl border text-right flex items-center justify-between gap-1.5 transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-[#15445A] bg-white text-stone-950 font-bold shadow-2xs'
                        : 'border-stone-200 bg-white/70 text-stone-700 hover:bg-white'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold">{sys.name}</div>
                      <div
                        className="text-[10px] text-stone-500 mt-0.5 tabular-nums"
                        dir="ltr"
                      >
                        {sys.primaryHex}
                      </div>
                    </div>
                    <span className="flex flex-col gap-1 shrink-0">
                      <span
                        className="w-4 h-2.5 rounded-xs border border-black/10"
                        style={{ backgroundColor: sys.primaryHex }}
                      />
                      <span
                        className="w-4 h-2.5 rounded-xs border border-black/10"
                        style={{ backgroundColor: sys.secondaryHex }}
                      />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Content Length & Signoff Toggles */}
          <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <Layers
                  className="w-4 h-4 text-[#1E4D8C]"
                  aria-hidden="true"
                />
                <span>٣. طول المحتوى وتعدد الصفحات</span>
              </span>
              <span
                data-testid="teacher-preview-page-count"
                className="text-xs font-bold text-stone-700 tabular-nums"
              >
                الصفحات: {paginatedPages.length}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                data-testid="teacher-mode-short"
                onClick={() => setContentMode('short')}
                className={`min-h-[38px] px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                  contentMode === 'short'
                    ? 'border-[#15445A] bg-white text-stone-950'
                    : 'border-stone-200 bg-white/70 text-stone-700 hover:bg-white'
                }`}
              >
                تقرير مختصر (صفحة ١)
              </button>
              <button
                type="button"
                data-testid="teacher-mode-multipage"
                onClick={() => setContentMode('multi-page')}
                className={`min-h-[38px] px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                  contentMode === 'multi-page'
                    ? 'border-[#15445A] bg-white text-stone-950'
                    : 'border-stone-200 bg-white/70 text-stone-700 hover:bg-white'
                }`}
              >
                تقرير مفصل (متعدد الصفحات)
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-stone-200/80 text-[11px] font-semibold text-stone-800">
              <label className="inline-flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  data-testid="teacher-toggle-executor"
                  checked={includeExecutor}
                  onChange={(e) => setIncludeExecutor(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-[#15445A]"
                />
                <span>المنفذ</span>
              </label>
              <label className="inline-flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  data-testid="teacher-toggle-national-id"
                  checked={includeNationalId}
                  onChange={(e) => setIncludeNationalId(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-[#15445A]"
                />
                <span>السجل المدني</span>
              </label>
              <label className="inline-flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  data-testid="teacher-toggle-signature"
                  checked={includeSignature}
                  onChange={(e) => setIncludeSignature(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-[#15445A]"
                />
                <span>التوقيع</span>
              </label>
              <label className="inline-flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  data-testid="teacher-toggle-principal"
                  checked={includePrincipal}
                  onChange={(e) => setIncludePrincipal(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-[#15445A]"
                />
                <span>مدير المدرسة</span>
              </label>
            </div>
          </div>
        </div>

        {/* Independent Evidence Controls: Left = Links, Right = Photos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-1">
          {/* A. Independent Photos Component (Max 2 Photos) */}
          <div
            data-testid="teacher-evidence-photos-panel"
            className="rounded-xl border border-stone-200 bg-stone-50/70 p-4 space-y-3.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Camera
                  className="w-4 h-4 text-[#1E4D8C] shrink-0"
                  aria-hidden="true"
                />
                <span className="text-sm font-bold text-stone-900">
                  أولًا: صور الشواهد (مكون مستقل — بحد أقصى صورتان)
                </span>
              </div>
              <span
                data-testid="teacher-photos-status-badge"
                className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-white border border-stone-200 text-stone-700"
              >
                الصور المرفوعة: {evidencePhotos.length} / 2
              </span>
            </div>

            {/* Quick Photo Count Selector + Device Upload */}
            <div className="flex flex-wrap items-center gap-2">
              {([0, 1, 2] as const).map((cnt) => (
                <button
                  key={cnt}
                  type="button"
                  data-testid={`teacher-photo-count-${cnt}`}
                  onClick={() => handleSetPhotoPresetCount(cnt)}
                  className={`min-h-[36px] px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
                    evidencePhotos.length === cnt
                      ? 'border-[#15445A] bg-white text-stone-950 shadow-2xs'
                      : 'border-stone-200 bg-white/70 text-stone-700 hover:bg-white'
                  }`}
                >
                  {cnt === 0
                    ? 'بدون صور (0)'
                    : cnt === 1
                      ? 'صورة واحدة (1)'
                      : 'صورتان (2)'}
                </button>
              ))}

              <input
                ref={addPhotoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/*"
                multiple
                data-testid="teacher-upload-photo-input"
                onChange={handleUploadNewPhotos}
                className="hidden"
              />

              {evidencePhotos.length < 2 && (
                <button
                  type="button"
                  data-testid="teacher-upload-photo-btn"
                  onClick={() => addPhotoInputRef.current?.click()}
                  className="min-h-[36px] px-3 py-1.5 rounded-lg text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer mr-auto"
                  style={{ backgroundColor: palette.primaryHex }}
                >
                  <ImagePlus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>رفع صورة من الجهاز (JPG / PNG / WebP)</span>
                </button>
              )}
            </div>

            {/* Photo Thumbnails Preview, Replace & Delete */}
            {evidencePhotos.length === 0 ? (
              <div
                data-testid="teacher-photos-empty-notice"
                className="rounded-xl border border-dashed border-stone-300 bg-white/80 p-4 text-center text-xs text-stone-600"
              >
                لم يتم رفع أي صورة حاليًا — لن يظهر إطار الصور أو أي مساحة فارغة للصور داخل قسم «الشواهد» في التقرير.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {evidencePhotos.map((photo, idx) => (
                  <div
                    key={photo.id}
                    data-testid={`teacher-photo-card-${idx + 1}`}
                    className="rounded-xl border border-stone-200 bg-white p-2.5 space-y-2 shadow-2xs"
                  >
                    <div className="aspect-[16/10] rounded-lg border border-stone-200 bg-stone-50 overflow-hidden relative">
                      <img
                        src={photo.imageDataUrl}
                        alt={`معاينة صورة الشاهد ${idx + 1}`}
                        data-testid={`teacher-photo-preview-${idx + 1}`}
                        className="w-full h-full object-contain block"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-[11px] font-bold text-stone-700">
                        صورة الشاهد ({idx + 1})
                      </span>
                      <div className="flex items-center gap-1.5">
                        <input
                          ref={(el) => {
                            replacePhotoInputRefs.current[idx] = el;
                          }}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/*"
                          data-testid={`teacher-replace-photo-input-${idx + 1}`}
                          onChange={(e) => handleReplacePhotoAt(idx, e)}
                          className="hidden"
                        />
                        <button
                          type="button"
                          data-testid={`teacher-replace-photo-${idx + 1}`}
                          onClick={() =>
                            replacePhotoInputRefs.current[idx]?.click()
                          }
                          aria-label={`استبدال صورة الشاهد ${idx + 1}`}
                          className="px-2.5 py-1 rounded-lg border border-stone-300 bg-stone-50 hover:bg-stone-100 text-[11px] font-bold text-stone-800 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" aria-hidden="true" />
                          <span>استبدال</span>
                        </button>
                        <button
                          type="button"
                          data-testid={`teacher-delete-photo-${idx + 1}`}
                          onClick={() => handleDeletePhotoAt(idx)}
                          aria-label={`حذف صورة الشاهد ${idx + 1}`}
                          className="px-2.5 py-1 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-[11px] font-bold text-red-700 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" aria-hidden="true" />
                          <span>حذف</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* B. Independent Electronic Links Component (Max 2 Links -> QR Codes) */}
          <div
            data-testid="teacher-evidence-links-panel"
            className="rounded-xl border border-stone-200 bg-stone-50/70 p-4 space-y-3.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Link2
                  className="w-4 h-4 text-[#1E4D8C] shrink-0"
                  aria-hidden="true"
                />
                <span className="text-sm font-bold text-stone-900">
                  ثانيًا: الروابط الإلكترونية ورموز QR (مكون مستقل — بحد أقصى رابطان)
                </span>
              </div>
              <span
                data-testid="teacher-links-status-badge"
                className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-white border border-stone-200 text-stone-700"
              >
                الروابط الفعالة: {activeValidLinksCount} / 2
              </span>
            </div>

            {/* Quick Link Count Selector + Add Link Button */}
            <div className="flex flex-wrap items-center gap-2">
              {([0, 1, 2] as const).map((cnt) => (
                <button
                  key={cnt}
                  type="button"
                  data-testid={`teacher-link-count-${cnt}`}
                  onClick={() => handleSetLinkPresetCount(cnt)}
                  className={`min-h-[36px] px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
                    evidenceLinks.length === cnt
                      ? 'border-[#15445A] bg-white text-stone-950 shadow-2xs'
                      : 'border-stone-200 bg-white/70 text-stone-700 hover:bg-white'
                  }`}
                >
                  {cnt === 0
                    ? 'بدون روابط (0)'
                    : cnt === 1
                      ? 'رابط واحد (1)'
                      : 'رابطان (2)'}
                </button>
              ))}

              {evidenceLinks.length < 2 && (
                <button
                  type="button"
                  data-testid="teacher-add-link-btn"
                  onClick={handleAddLink}
                  className="min-h-[36px] px-3 py-1.5 rounded-lg text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer mr-auto"
                  style={{ backgroundColor: palette.secondaryHex }}
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>إضافة رابط إلكتروني</span>
                </button>
              )}
            </div>

            {/* Links List with Live QR Preview, Edit URL & Delete */}
            {evidenceLinks.length === 0 ? (
              <div
                data-testid="teacher-links-empty-notice"
                className="rounded-xl border border-dashed border-stone-300 bg-white/80 p-4 text-center text-xs text-stone-600"
              >
                لم يتم إدخال أي رابط إلكتروني حاليًا — لن يظهر مستطيل الروابط أو رموز QR أو أي مساحة فارغة لها في التقرير.
              </div>
            ) : (
              <div className="space-y-2.5">
                {evidenceLinks.map((linkItem, idx) => {
                  const hasValidUrl = Boolean(
                    linkItem.url && linkItem.url.trim()
                  );
                  const qrPreviewUrl = hasValidUrl
                    ? generateQrSvgDataUrl(
                        linkItem.url.trim(),
                        palette.secondaryHex,
                        '#FFFFFF',
                        2
                      )
                    : null;

                  return (
                    <div
                      key={linkItem.id}
                      data-testid={`teacher-link-card-${idx + 1}`}
                      className="rounded-xl border border-stone-200 bg-white p-2.5 flex items-center gap-3 shadow-2xs"
                    >
                      {/* Live QR Code Thumbnail */}
                      <div className="w-14 h-14 rounded-lg border border-stone-200 bg-white p-1 shrink-0 flex items-center justify-center">
                        {qrPreviewUrl ? (
                          <img
                            src={qrPreviewUrl}
                            alt={`رمز QR للرابط ${idx + 1}`}
                            data-testid={`teacher-link-qr-preview-${idx + 1}`}
                            className="w-full h-full object-contain block"
                          />
                        ) : (
                          <span className="text-[10px] text-stone-400">فارغ</span>
                        )}
                      </div>

                      {/* URL Input */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <label
                            htmlFor={`teacher-ev-link-${idx + 1}`}
                            className="text-[11px] font-bold text-stone-800"
                          >
                            الرابط الإلكتروني ({idx + 1}) — يتحول تلقائيًا إلى QR قابل للمسح والنقر:
                          </label>
                          <button
                            type="button"
                            data-testid={`teacher-delete-link-${idx + 1}`}
                            onClick={() => handleDeleteLinkAt(idx)}
                            aria-label={`حذف الرابط الإلكتروني ${idx + 1}`}
                            className="px-2 py-0.5 rounded-md border border-red-200 bg-red-50 hover:bg-red-100 text-[11px] font-bold text-red-700 inline-flex items-center gap-1 cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-3 h-3" aria-hidden="true" />
                            <span>حذف</span>
                          </button>
                        </div>
                        <input
                          id={`teacher-ev-link-${idx + 1}`}
                          data-testid={`teacher-ev-link-${idx + 1}-input`}
                          type="url"
                          dir="ltr"
                          value={linkItem.url}
                          onChange={(e) =>
                            handleUpdateLinkAt(idx, e.target.value)
                          }
                          placeholder="https://..."
                          className="w-full min-h-[34px] px-2.5 py-1 rounded-lg border border-stone-300 bg-stone-50/50 focus:bg-white text-xs text-stone-900"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Quick Combined Scenarios Bar for Fast Verification */}
            <div className="pt-2 border-t border-stone-200/80 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-stone-600 ml-1">
                حالات جاهزة للاختبار السريع:
              </span>
              <button
                type="button"
                data-testid="teacher-scenario-2photos-0links"
                onClick={() => {
                  handleSetPhotoPresetCount(2);
                  handleSetLinkPresetCount(0);
                }}
                className="px-2.5 py-1 rounded-md border border-stone-300 bg-white hover:bg-stone-50 text-[11px] font-bold text-stone-800 cursor-pointer"
              >
                صورتان دون روابط
              </button>
              <button
                type="button"
                data-testid="teacher-scenario-0photos-2links"
                onClick={() => {
                  handleSetPhotoPresetCount(0);
                  handleSetLinkPresetCount(2);
                }}
                className="px-2.5 py-1 rounded-md border border-stone-300 bg-white hover:bg-stone-50 text-[11px] font-bold text-stone-800 cursor-pointer"
              >
                رابطان دون صور
              </button>
              <button
                type="button"
                data-testid="teacher-scenario-1photo-1link"
                onClick={() => {
                  handleSetPhotoPresetCount(1);
                  handleSetLinkPresetCount(1);
                }}
                className="px-2.5 py-1 rounded-md border border-stone-300 bg-white hover:bg-stone-50 text-[11px] font-bold text-stone-800 cursor-pointer"
              >
                صورة واحدة ورابط واحد
              </button>
              <button
                type="button"
                data-testid="teacher-scenario-2photos-2links"
                onClick={() => {
                  handleSetPhotoPresetCount(2);
                  handleSetLinkPresetCount(2);
                }}
                className="px-2.5 py-1 rounded-md border border-stone-300 bg-white hover:bg-stone-50 text-[11px] font-bold text-stone-800 cursor-pointer"
              >
                صورتان ورابطان
              </button>
              <button
                type="button"
                data-testid="teacher-scenario-0photos-0links"
                onClick={() => {
                  handleSetPhotoPresetCount(0);
                  handleSetLinkPresetCount(0);
                }}
                className="px-2.5 py-1 rounded-md border border-stone-300 bg-white hover:bg-stone-50 text-[11px] font-bold text-stone-800 cursor-pointer"
              >
                بدون صور أو روابط
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Side-by-Side 3-Template Visual Comparison Grid */}
      {viewMode === 'compare' && (
        <section
          data-testid="teacher-comparison-grid"
          className="bg-white rounded-2xl border border-stone-200/90 p-6 sm:p-8 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-4">
            <div>
              <h3 className="text-lg font-extrabold font-display text-stone-900">
                المقارنة البصرية المباشرة للقوالب الثلاثة — {palette.name}
              </h3>
              <p className="text-xs sm:text-sm text-stone-600 mt-0.5">
                قارن بين القوالب الثلاثة جنباً إلى جنب وتأكد من انعكاس نظام الألوان المختار على كامل الهوية الزخرفية وقسم «الشواهد».
              </p>
            </div>
            <div className="flex items-center gap-2">
              {ALL_COLOR_SYSTEMS.map((sysId) => {
                const sys = TEACHER_COLOR_PALETTES[sysId];
                return (
                  <button
                    key={sysId}
                    type="button"
                    onClick={() => handleSelectColorSystem(sysId)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${
                      colorSystem === sysId
                        ? 'border-[#15445A] bg-stone-900 text-white'
                        : 'border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100'
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full border border-white/40"
                      style={{ backgroundColor: sys.primaryHex }}
                    />
                    <span>{sys.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {ALL_TEMPLATES.map((tplId) => {
              const tplDef = TEACHER_TEMPLATE_DEFINITIONS[tplId];
              const pageRender = comparisonPagesMap[tplId];
              const isCurrent = templateStyle === tplId;

              return (
                <div
                  key={tplId}
                  data-testid={`compare-card-${tplId}`}
                  className={`rounded-2xl border-2 p-4 flex flex-col justify-between gap-4 transition-all ${
                    isCurrent
                      ? 'border-[#15445A] bg-[#F4F8FC]/60'
                      : 'border-stone-200 bg-stone-50/40'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-base font-extrabold text-stone-900">
                        {tplDef.name}
                      </h4>
                      {isCurrent && (
                        <span
                          className="px-2.5 py-0.5 rounded-full text-[11px] font-bold text-white"
                          style={{ backgroundColor: palette.primaryHex }}
                        >
                          القالب المحدد
                        </span>
                      )}
                    </div>

                    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden shadow-xs aspect-[1240/1754] relative">
                      {pageRender?.dataUrl ? (
                        <img
                          src={pageRender.dataUrl}
                          alt={`معاينة ${tplDef.name} - ${palette.name}`}
                          data-testid={`compare-img-${tplId}`}
                          className="w-full h-full object-contain block"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-stone-400">
                          جاري رسم القالب...
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      data-testid={`compare-select-${tplId}`}
                      onClick={() => {
                        handleSelectTemplate(tplId);
                        setViewMode('single');
                      }}
                      className="flex-1 min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-xs font-bold text-stone-900 cursor-pointer"
                    >
                      اعتماد ومعاينة بحجم A4
                    </button>
                    <button
                      type="button"
                      data-testid={`compare-export-${tplId}`}
                      onClick={() => handleExportPdf(tplId)}
                      className="min-h-[40px] px-3.5 py-1.5 rounded-xl text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                      style={{ backgroundColor: palette.secondaryHex }}
                    >
                      <FileDown className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>PDF</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Full A4 Portrait Live Preview (100% Pixel-Identical to Exported PDF + Interactive Clickable QR Overlays) */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 print:hidden">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-stone-800">
            <Eye className="w-4 h-4 text-[#1E4D8C]" aria-hidden="true" />
            <span>
              المعاينة الحية المطابقة ١٠٠٪ لملف PDF (مقاس A4 طولي ·{' '}
              {activeTemplateDef.name} · {palette.name})
            </span>
          </div>
          <span className="text-xs text-stone-500">
            انقر على أي رمز QR في الصفحة لاختبار الرابط التفاعلي أو صدّر ملف PDF للتحقق منه
          </span>
        </div>

        <div className="space-y-8">
          {renderedPages.map((pageData, pageIdx) => (
            <article
              key={pageIdx}
              dir="rtl"
              data-testid={`teacher-a4-page-${pageIdx}`}
              data-template-style={templateStyle}
              data-color-system={colorSystem}
              data-links-count={pageData.links.length}
              className="relative bg-white mx-auto border border-stone-200 rounded-xl shadow-xs overflow-hidden max-w-[210mm] aspect-[1240/1754]"
            >
              {pageData.dataUrl ? (
                <img
                  src={pageData.dataUrl}
                  alt={`صفحة تقرير المعلم ${pageIdx + 1} - ${activeTemplateDef.name}`}
                  data-testid={`teacher-a4-canvas-img-${pageIdx}`}
                  className="w-full h-full object-contain block select-none"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-sm text-stone-400">
                  جاري تجهيز المعاينة عالية الدقة...
                </div>
              )}

              {/* Interactive Clickable QR Overlays positioned at exact PDF Link coordinates */}
              {pageData.links.map((link, lIdx) => {
                const leftPct = (link.xPx / pageData.pixelWidth) * 100;
                const topPct = (link.yPx / pageData.pixelHeight) * 100;
                const widthPct = (link.wPx / pageData.pixelWidth) * 100;
                const heightPct = (link.hPx / pageData.pixelHeight) * 100;

                return (
                  <a
                    key={lIdx}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid={`teacher-evidence-qr-link-${lIdx + 1}`}
                    aria-label={`فتح رابط الشاهد الإلكتروني ${lIdx + 1}`}
                    title={`انقر لفتح الرابط: ${link.url}`}
                    style={{
                      left: `${leftPct}%`,
                      top: `${topPct}%`,
                      width: `${widthPct}%`,
                      height: `${heightPct}%`,
                    }}
                    className="absolute block rounded-lg ring-2 ring-transparent hover:ring-[#07A869] hover:bg-black/5 transition-all cursor-pointer"
                  />
                );
              })}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};
