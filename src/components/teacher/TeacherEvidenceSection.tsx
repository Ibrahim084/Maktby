import React, { useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  ImagePlus,
  Link2,
  Plus,
  QrCode,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { TeacherPdfColorSystem } from '../../types';
import { generateQrSvgDataUrl } from '../../utils/qrCodeGenerator';
import {
  bytesToDataUrl,
  getDefaultTeacherMediaRepository,
  saveMediaBytes,
  saveMediaDataUrl,
  TeacherMediaRepository,
} from '../../utils/teacherMediaStorage';
import {
  createDefaultSampleEvidencePhotos,
  getTeacherColorPalette,
  TeacherReportEvidenceLink,
  TeacherReportEvidencePhoto,
} from '../../utils/teacherPdfEngine';

interface TeacherEvidenceSectionProps {
  photos: TeacherReportEvidencePhoto[];
  links: TeacherReportEvidenceLink[];
  colorSystem?: TeacherPdfColorSystem;
  enableMediaStore?: boolean;
  mediaRepository?: TeacherMediaRepository;
  onChangePhotos: (nextPhotos: TeacherReportEvidencePhoto[]) => void;
  onChangeLinks: (nextLinks: TeacherReportEvidenceLink[]) => void;
}

function readImageFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Invalid file result'));
      }
    };
    reader.onerror = () => reject(new Error('File read error'));
    reader.readAsDataURL(file);
  });
}

async function readImageFileForEvidence(
  file: File,
  enableMediaStore: boolean,
  mediaRepository?: TeacherMediaRepository
): Promise<{ dataUrl: string; deduplicated: boolean; blobKey?: string }> {
  if (!enableMediaStore) {
    return {
      dataUrl: await readImageFileAsDataUrl(file),
      deduplicated: false,
    };
  }
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const mimeType = file.type || 'image/png';
  const repo = mediaRepository ?? getDefaultTeacherMediaRepository();
  const saved = await saveMediaBytes(
    {
      bytes,
      fileName: file.name || 'evidence-image',
      mimeType,
      sourceTag: 'upload',
    },
    repo
  );
  return {
    dataUrl: bytesToDataUrl(bytes, mimeType),
    deduplicated: saved.deduplicated,
    blobKey: saved.mediaRef.blobKey,
  };
}

export const TeacherEvidenceSection: React.FC<TeacherEvidenceSectionProps> = ({
  photos,
  links,
  colorSystem = 'green',
  enableMediaStore = false,
  mediaRepository,
  onChangePhotos,
  onChangeLinks,
}) => {
  const palette = getTeacherColorPalette(colorSystem);
  const addPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const replacePhotoInputRefs = useRef<Record<number, HTMLInputElement | null>>(
    {}
  );
  const [mediaNotice, setMediaNotice] = useState<string | null>(null);

  const handleUploadNewPhotos = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    try {
      const remainingSlots = Math.max(0, 2 - photos.length);
      const filesToRead = files.slice(0, Math.max(1, remainingSlots));
      const results = await Promise.all(
        filesToRead.map((file) =>
          readImageFileForEvidence(file, enableMediaStore, mediaRepository)
        )
      );

      const combined = [
        ...photos,
        ...results.map((item, idx) => ({
          id: `photo-${Date.now()}-${idx + 1}`,
          imageDataUrl: item.dataUrl,
        })),
      ].slice(0, 2);
      onChangePhotos(combined);

      if (enableMediaStore) {
        const anyDeduplicated = results.some((r) => r.deduplicated);
        setMediaNotice(
          anyDeduplicated
            ? 'تمت مطابقة بصمة SHA-256 واستخدام المرفق المحفوظ مسبقًا دون تكرار في IndexedDB.'
            : 'تم حفظ المرفق الثنائي والتحقق من بصمته (SHA-256 / CRC-32) في IndexedDB.'
        );
      }
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
      const item = await readImageFileForEvidence(
        file,
        enableMediaStore,
        mediaRepository
      );
      onChangePhotos(
        photos.map((p, idx) =>
          idx === index
            ? {
                id: `photo-replaced-${Date.now()}-${index + 1}`,
                imageDataUrl: item.dataUrl,
              }
            : p
        )
      );
      if (enableMediaStore) {
        setMediaNotice(
          item.deduplicated
            ? 'تمت مطابقة بصمة SHA-256 واستخدام المرفق المحفوظ مسبقًا دون تكرار في IndexedDB.'
            : 'تم تحديث المرفق وحفظه في مستودع المرفقات مع بصمة SHA-256.'
        );
      }
    } catch {
      // Ignore invalid image read
    } finally {
      e.target.value = '';
    }
  };

  const handleDeletePhotoAt = (index: number) => {
    setMediaNotice(null);
    onChangePhotos(photos.filter((_, idx) => idx !== index));
  };

  const handleLoadSamplePhotos = async () => {
    const samples = createDefaultSampleEvidencePhotos(colorSystem);
    const chosen = [samples[0], samples[1]];
    onChangePhotos(chosen);
    if (enableMediaStore) {
      const repo = mediaRepository ?? getDefaultTeacherMediaRepository();
      await Promise.all(
        chosen.map((p, idx) =>
          saveMediaDataUrl(
            {
              id: p.id,
              dataUrl: p.imageDataUrl,
              fileName: `sample-evidence-${idx + 1}.svg`,
              sourceTag: 'sample',
            },
            repo
          )
        )
      );
      setMediaNotice('تم حفظ الصور التجريبية في مستودع المرفقات الموحد.');
    }
  };

  const handleAddLink = () => {
    if (links.length >= 2) return;
    onChangeLinks([
      ...links,
      {
        id: `link-${Date.now()}-${links.length + 1}`,
        url: '',
      },
    ]);
  };

  const handleUpdateLinkAt = (index: number, nextUrl: string) => {
    onChangeLinks(
      links.map((item, idx) =>
        idx === index ? { ...item, url: nextUrl } : item
      )
    );
  };

  const handleDeleteLinkAt = (index: number) => {
    onChangeLinks(links.filter((_, idx) => idx !== index));
  };

  const activeLinksCount = links.filter((l) => Boolean(l.url && l.url.trim())).length;

  return (
    <section
      aria-label="قسم الشواهد والروابط الإلكترونية"
      className="rounded-2xl border border-stone-200 bg-stone-50/60 p-5 space-y-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200/80 pb-3">
        <div>
          <h3 className="text-base font-bold font-display text-stone-900">
            الشواهد والروابط الإلكترونية (اختياري)
          </h3>
          <p className="text-xs text-stone-600 mt-0.5">
            يمكنك إرفاق صورتين كحد أقصى ورابطين إلكترونيين كحد أقصى بشكل مستقل؛ يتحول كل رابط تلقائيًا إلى رمز QR قابل للمسح والنقر داخل ملف PDF.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 1. Independent Photos Upload (0..2) */}
        <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <Camera className="w-4 h-4 text-[#416B91]" aria-hidden="true" />
              <span>صور الشواهد (بحد أقصى صورتان)</span>
            </span>
            <span
              data-testid="form-evidence-photos-count"
              className="text-xs font-bold text-stone-700 bg-stone-100 px-2.5 py-1 rounded-lg border border-stone-200 tabular-nums"
            >
              {photos.length} / 2
            </span>
          </div>

          <input
            ref={addPhotoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            data-testid="form-upload-photo-input"
            onChange={handleUploadNewPhotos}
            className="hidden"
          />

          {photos.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {photos.map((photo, idx) => (
                <div
                  key={photo.id}
                  data-testid={`form-photo-card-${idx + 1}`}
                  className="rounded-xl border border-stone-200 bg-stone-50/70 p-2.5 flex flex-col justify-between gap-2"
                >
                  <div className="aspect-[16/10] w-full rounded-lg border border-stone-200 bg-white overflow-hidden flex items-center justify-center">
                    <img
                      src={photo.imageDataUrl}
                      alt={`معاينة صورة الشاهد ${idx + 1}`}
                      className="w-full h-full object-contain block"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-1.5 pt-1">
                    <span className="text-[11px] font-bold text-stone-700">
                      صورة الشاهد ({idx + 1})
                    </span>

                    <div className="flex items-center gap-1.5">
                      <input
                        ref={(el) => {
                          replacePhotoInputRefs.current[idx] = el;
                        }}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        data-testid={`form-replace-photo-input-${idx + 1}`}
                        onChange={(e) => handleReplacePhotoAt(idx, e)}
                        className="hidden"
                      />
                      <button
                        type="button"
                        data-testid={`form-replace-photo-btn-${idx + 1}`}
                        onClick={() =>
                          replacePhotoInputRefs.current[idx]?.click()
                        }
                        className="min-h-[30px] px-2.5 py-1 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-[11px] font-bold text-stone-800 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" aria-hidden="true" />
                        <span>استبدال</span>
                      </button>

                      <button
                        type="button"
                        data-testid={`form-delete-photo-btn-${idx + 1}`}
                        onClick={() => handleDeletePhotoAt(idx)}
                        className="min-h-[30px] px-2.5 py-1 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-[11px] font-bold text-red-700 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" aria-hidden="true" />
                        <span>حذف</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50/60 p-4 text-center text-xs text-stone-500">
              لم يتم إرفاق أي صورة حتى الآن — في حال عدم رفع صور لن يظهر إطار الصور داخل ملف PDF.
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {photos.length < 2 && (
              <button
                type="button"
                data-testid="form-add-photo-btn"
                onClick={() => addPhotoInputRef.current?.click()}
                className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-dashed border-[#416B91]/50 bg-[#FBFBF9] hover:bg-[#DCEAF5] text-xs font-bold text-[#416B91] inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <ImagePlus className="w-4 h-4" aria-hidden="true" />
                <span>رفع صورة من الجهاز (JPG / PNG / WebP)</span>
              </button>
            )}
            {photos.length === 0 && (
              <button
                type="button"
                data-testid="form-load-sample-photos-btn"
                onClick={handleLoadSamplePhotos}
                className="min-h-[38px] px-3 py-1.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-xs font-semibold text-stone-700 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <span>إدراج صورتين تجريبيتين للمعاينة</span>
              </button>
            )}
          </div>

          {mediaNotice && (
            <p
              data-testid="evidence-media-store-notice"
              className="text-xs font-semibold text-[#416B91] bg-[#DCEAF5] border border-[#E2E5E6] rounded-lg px-3 py-2 flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>{mediaNotice}</span>
            </p>
          )}
        </div>

        {/* 2. Independent Electronic Links & QR Codes (0..2) */}
        <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <QrCode className="w-4 h-4 text-[#416B91]" aria-hidden="true" />
              <span>روابط الشواهد ورموز QR (بحد أقصى رابطان)</span>
            </span>
            <span
              data-testid="form-evidence-links-count"
              className="text-xs font-bold text-stone-700 bg-stone-100 px-2.5 py-1 rounded-lg border border-stone-200 tabular-nums"
            >
              الروابط الفعالة: {activeLinksCount} / 2
            </span>
          </div>

          {links.length > 0 ? (
            <div className="space-y-2.5">
              {links.map((linkItem, idx) => {
                const cleanUrl = linkItem.url?.trim() || '';
                const qrPreviewUrl = cleanUrl
                  ? generateQrSvgDataUrl(
                      cleanUrl,
                      palette.secondaryHex,
                      '#FFFFFF',
                      2
                    )
                  : null;

                return (
                  <div
                    key={linkItem.id}
                    data-testid={`form-link-card-${idx + 1}`}
                    className="rounded-xl border border-stone-200 bg-stone-50/70 p-2.5 flex items-center gap-3"
                  >
                    <div className="w-14 h-14 rounded-lg border border-stone-200 bg-white p-1 shrink-0 flex items-center justify-center">
                      {qrPreviewUrl ? (
                        <img
                          src={qrPreviewUrl}
                          alt={`رمز QR للرابط ${idx + 1}`}
                          className="w-full h-full object-contain block"
                        />
                      ) : (
                        <QrCode
                          className="w-6 h-6 text-stone-300"
                          aria-hidden="true"
                        />
                      )}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <label
                          htmlFor={`form-evidence-link-input-${idx + 1}`}
                          className="text-[11px] font-bold text-stone-800 flex items-center gap-1"
                        >
                          <Link2
                            className="w-3.5 h-3.5 text-[#2F6846]"
                            aria-hidden="true"
                          />
                          <span>الرابط الإلكتروني ({idx + 1}):</span>
                        </label>

                        <button
                          type="button"
                          data-testid={`form-delete-link-btn-${idx + 1}`}
                          onClick={() => handleDeleteLinkAt(idx)}
                          className="min-h-[26px] px-2 py-0.5 rounded-md border border-red-200 bg-red-50 hover:bg-red-100 text-[11px] font-bold text-red-700 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" aria-hidden="true" />
                          <span>حذف</span>
                        </button>
                      </div>

                      <input
                        id={`form-evidence-link-input-${idx + 1}`}
                        type="url"
                        dir="ltr"
                        data-testid={`form-link-input-${idx + 1}`}
                        value={linkItem.url}
                        onChange={(e) =>
                          handleUpdateLinkAt(idx, e.target.value)
                        }
                        placeholder="https://..."
                        className="w-full min-h-[36px] px-2.5 py-1 rounded-lg border border-stone-300 bg-white text-xs text-stone-900 focus:outline-none focus:border-[#416B91]"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50/60 p-4 text-center text-xs text-stone-500">
              لم يتم إضافة أي رابط إلكتروني — في حال عدم إدخال روابط لن يظهر مستطيل QR داخل ملف PDF.
            </div>
          )}

          {links.length < 2 && (
            <button
              type="button"
              data-testid="form-add-link-btn"
              onClick={handleAddLink}
              className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-dashed border-[#416B91]/50 bg-[#FBFBF9] hover:bg-[#DCEAF5] text-xs font-bold text-[#416B91] inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>إضافة رابط إلكتروني (يتحول إلى QR)</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
};
