import { SchoolSettings } from '../types';
import { FormValues } from '../types/forms';
import {
  buildOfficialCertificateContent,
  buildPdfFromJpegBytes,
  CertificateBeneficiaryEntry,
  CertificateVariant,
  generateCertificatePdfBytes,
  parseCertificateBeneficiaries,
} from './certificatePdfGenerator';

export interface ZipFileEntry {
  filename: string;
  content: Uint8Array | string;
  beneficiaryName?: string;
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export function computeCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Builds a standard PKZIP archive (STORE method, UTF-8 filenames) in memory.
 * Supports binary Uint8Array entries (such as real .pdf files) as well as string entries.
 */
export function createZipArchiveBytes(entries: ZipFileEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const localFileParts: Uint8Array[] = [];
  const centralDirParts: Uint8Array[] = [];
  let currentOffset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.filename);
    const dataBytes =
      entry.content instanceof Uint8Array
        ? entry.content
        : encoder.encode(entry.content);
    const crc = computeCrc32(dataBytes);
    const size = dataBytes.length;

    // Local file header (30 bytes + filename)
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true); // Local file header signature
    localView.setUint16(4, 20, true); // Version needed to extract (2.0)
    localView.setUint16(6, 0x0800, true); // General purpose bit flag (UTF-8)
    localView.setUint16(8, 0, true); // Compression method (0 = STORE)
    localView.setUint16(10, 0, true); // File last modification time
    localView.setUint16(12, 0x0021, true); // File last modification date
    localView.setUint32(14, crc, true); // CRC-32
    localView.setUint32(18, size, true); // Compressed size
    localView.setUint32(22, size, true); // Uncompressed size
    localView.setUint16(26, nameBytes.length, true); // File name length
    localView.setUint16(28, 0, true); // Extra field length
    localHeader.set(nameBytes, 30);

    localFileParts.push(localHeader, dataBytes);

    // Central directory file header (46 bytes + filename)
    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true); // Central directory signature
    centralView.setUint16(4, 20, true); // Version made by
    centralView.setUint16(6, 20, true); // Version needed to extract
    centralView.setUint16(8, 0x0800, true); // General purpose bit flag (UTF-8)
    centralView.setUint16(10, 0, true); // Compression method (0 = STORE)
    centralView.setUint16(12, 0, true); // File last modification time
    centralView.setUint16(14, 0x0021, true); // File last modification date
    centralView.setUint32(16, crc, true); // CRC-32
    centralView.setUint32(20, size, true); // Compressed size
    centralView.setUint32(24, size, true); // Uncompressed size
    centralView.setUint16(28, nameBytes.length, true); // File name length
    centralView.setUint16(30, 0, true); // Extra field length
    centralView.setUint16(32, 0, true); // File comment length
    centralView.setUint16(34, 0, true); // Disk number start
    centralView.setUint16(36, 0, true); // Internal file attributes
    centralView.setUint32(38, 0, true); // External file attributes
    centralView.setUint32(42, currentOffset, true); // Relative offset of local header
    centralHeader.set(nameBytes, 46);

    centralDirParts.push(centralHeader);
    currentOffset += localHeader.length + dataBytes.length;
  }

  const centralDirSize = centralDirParts.reduce((sum, p) => sum + p.length, 0);
  const centralDirOffset = currentOffset;

  // End of central directory record (22 bytes)
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true); // EOCD signature
  eocdView.setUint16(4, 0, true); // Number of this disk
  eocdView.setUint16(6, 0, true); // Disk where central directory starts
  eocdView.setUint16(8, entries.length, true); // Number of central directory records on this disk
  eocdView.setUint16(10, entries.length, true); // Total number of central directory records
  eocdView.setUint32(12, centralDirSize, true); // Size of central directory
  eocdView.setUint32(16, centralDirOffset, true); // Offset of start of central directory
  eocdView.setUint16(20, 0, true); // Comment length

  const totalSize = currentOffset + centralDirSize + eocd.length;
  const output = new Uint8Array(totalSize);
  let pos = 0;

  for (const part of localFileParts) {
    output.set(part, pos);
    pos += part.length;
  }
  for (const part of centralDirParts) {
    output.set(part, pos);
    pos += part.length;
  }
  output.set(eocd, pos);

  return output;
}

/**
 * Parses a multi-line string of trainee names into a clean array of non-empty names.
 */
export function parseBatchTraineeNames(rawText: unknown): string[] {
  if (typeof rawText !== 'string') return [];
  return rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function sanitizeFilenameSegment(text: string): string {
  return (text || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '_')
    .slice(0, 80);
}

export function buildCertificatePdfFilename(
  variant: CertificateVariant,
  beneficiaryName: string,
  programTitle: string,
  usedFilenames?: Set<string>,
  index = 0
): string {
  const prefix = variant === 'trainer' ? 'شهادة_مدرب' : 'شهادة_متدرب';
  const safeBeneficiary =
    sanitizeFilenameSegment(beneficiaryName) ||
    (variant === 'trainer' ? `مدرب_${index + 1}` : `متدرب_${index + 1}`);
  const safeProgram = sanitizeFilenameSegment(programTitle) || 'برنامج_تدريبي';

  let filename = `${prefix}_${safeBeneficiary}_${safeProgram}.pdf`;
  if (usedFilenames && usedFilenames.has(filename)) {
    filename = `${prefix}_${index + 1}_${safeBeneficiary}_${safeProgram}.pdf`;
  }
  if (usedFilenames) {
    usedFilenames.add(filename);
  }
  return filename;
}

/**
 * Asynchronously builds real single-page A4 Landscape PDF files (.pdf) for each beneficiary.
 */
export async function buildCertificatePdfFilesAsync(
  variant: CertificateVariant,
  values: FormValues,
  settings: SchoolSettings,
  explicitTraineeNames?: string[]
): Promise<ZipFileEntry[]> {
  const beneficiaries: CertificateBeneficiaryEntry[] = explicitTraineeNames
    ? parseCertificateBeneficiaries(
        {
          ...values,
          beneficiaryName: explicitTraineeNames.join('\n'),
        },
        true
      )
    : parseCertificateBeneficiaries(values, variant === 'trainee');

  const programTitle =
    typeof values.programTitle === 'string' && values.programTitle.trim()
      ? values.programTitle.trim()
      : 'برنامج_تدريبي';

  const usedFilenames = new Set<string>();
  const results: ZipFileEntry[] = [];

  for (let idx = 0; idx < beneficiaries.length; idx++) {
    const beneficiary = beneficiaries[idx];
    const content = buildOfficialCertificateContent(
      variant,
      beneficiary,
      values,
      settings
    );
    const pdfBytes = await generateCertificatePdfBytes(content);
    const filename = buildCertificatePdfFilename(
      variant,
      beneficiary.name,
      programTitle,
      usedFilenames,
      idx
    );

    results.push({
      filename,
      content: pdfBytes,
      beneficiaryName: beneficiary.name,
    });
  }

  return results;
}

const MINIMAL_TEST_JPEG = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01,
  0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xd9,
]);

/**
 * Synchronous helper for generating PDF certificate file entries in unit tests or initial previews.
 * Always produces `.pdf` files with valid `%PDF-1.4` binary content (never `.html`).
 */
export function buildTraineeCertificateFiles(
  traineeNames: string[],
  values: FormValues,
  _settings: SchoolSettings
): ZipFileEntry[] {
  const programTitle =
    typeof values.programTitle === 'string' && values.programTitle.trim()
      ? values.programTitle.trim()
      : 'برنامج_تدريبي';

  const beneficiaries = parseCertificateBeneficiaries(
    {
      ...values,
      beneficiaryName: traineeNames.join('\n'),
    },
    true
  );

  const usedFilenames = new Set<string>();
  const pdfBytes = buildPdfFromJpegBytes(MINIMAL_TEST_JPEG, 2400, 1697);

  return beneficiaries.map((beneficiary, idx) => {
    const filename = buildCertificatePdfFilename(
      'trainee',
      beneficiary.name,
      programTitle,
      usedFilenames,
      idx
    );
    return {
      filename,
      content: pdfBytes,
      beneficiaryName: beneficiary.name,
    };
  });
}
