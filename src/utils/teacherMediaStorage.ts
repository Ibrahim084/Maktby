import { computeCrc32 } from './zipBuilder';

// ============================================================================
// Constants (Strictly Isolated from PD & Gifted IndexedDB Stores)
// ============================================================================
export const TEACHER_MEDIA_DB_NAME = 'maktabi_teacher_media_db_v1';
export const TEACHER_MEDIA_STORE_NAME = 'media_blobs_v1';
export const TEACHER_MEDIA_DB_VERSION = 1;

/**
 * Known archive localStorage keys scanned during global reference counting.
 * Pilot phase registers Batch 1 (professional reports); future batches append here.
 */
export const TEACHER_ARCHIVE_KNOWN_STORAGE_KEYS: readonly string[] = [
  'maktabi_teacher_reports_archive_v1',
  'maktabi_teacher_plans_archive_v1',
  'maktabi_teacher_meetings_archive_v1',
  'maktabi_teacher_peer_visits_archive_v1',
  'maktabi_teacher_tests_eval_archive_v1',
  'maktabi_teacher_programs_activities_archive_v1',
  'maktabi_teacher_certificates_archive_v1',
  'maktabi_teacher_portfolio_v1',
];

export interface UnifiedMediaRef {
  id: string;
  blobKey: string; // Content-addressed: 'sha256:<64-char-hex>'
  contentSha256: string;
  crc32: number;
  fileName: string;
  mimeType: string;
  byteLength: number;
  createdAt: string;
  sourceTag?: 'upload' | 'legacy-migration' | 'sample';
}

export interface StoredMediaBlobRecord {
  blobKey: string;
  bytes: Uint8Array;
  contentSha256: string;
  crc32: number;
  mimeType: string;
  fileName: string;
  byteLength: number;
  createdAt: string;
}

export interface TeacherMediaRepository {
  getBlob(blobKey: string): Promise<StoredMediaBlobRecord | null>;
  putBlob(record: StoredMediaBlobRecord): Promise<void>;
  deleteBlob(blobKey: string): Promise<boolean>;
  listBlobKeys(): Promise<string[]>;
  countBlobs(): Promise<number>;
}

export interface SaveMediaInput {
  bytes: Uint8Array;
  fileName: string;
  mimeType: string;
  id?: string;
  sourceTag?: UnifiedMediaRef['sourceTag'];
  createdAt?: string;
}

export interface SaveMediaResult {
  mediaRef: UnifiedMediaRef;
  deduplicated: boolean;
}

export interface LoadMediaResult {
  ok: boolean;
  reason?: 'missing' | 'corrupted' | 'io-error';
  integrityError?: string;
  record?: StoredMediaBlobRecord;
  dataUrl?: string;
}

// ============================================================================
// Pure-JS SHA-256 Implementation (FIPS 180-4) + WebCrypto Acceleration
// ============================================================================
const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits));
}

export function computeSha256HexSync(bytes: Uint8Array): string {
  const bitLenHi = Math.floor((bytes.length * 8) / 0x100000000);
  const bitLenLo = (bytes.length * 8) >>> 0;

  // Pad length: bytes + 1 byte (0x80) + padding zeros + 8 bytes length == multiple of 64
  const rem = (bytes.length + 9) % 64;
  const padZeroCount = rem === 0 ? 0 : 64 - rem;
  const padded = new Uint8Array(bytes.length + 1 + padZeroCount + 8);
  padded.set(bytes, 0);
  padded[bytes.length] = 0x80;

  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 8, bitLenHi, false);
  dv.setUint32(padded.length - 4, bitLenLo, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);

  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = dv.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((word) => word.toString(16).padStart(8, '0'))
    .join('');
}

export async function computeSha256Hex(bytes: Uint8Array): Promise<string> {
  try {
    const subtle = globalThis.crypto?.subtle;
    if (subtle) {
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      const digest = await subtle.digest('SHA-256', copy.buffer);
      const out = new Uint8Array(digest);
      let hex = '';
      for (let i = 0; i < out.length; i++) {
        hex += out[i].toString(16).padStart(2, '0');
      }
      return hex;
    }
  } catch {
    // Fallback to pure-JS implementation when crypto.subtle is unavailable (e.g., insecure origin)
  }
  return computeSha256HexSync(bytes);
}

// ============================================================================
// Data URL <-> Binary Bytes Helpers (Browser + Node Safe)
// ============================================================================
function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/\s+/g, '');
  if (typeof globalThis.atob === 'function') {
    const bin = globalThis.atob(clean);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      out[i] = bin.charCodeAt(i);
    }
    return out;
  }
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(clean, 'base64'));
  }
  throw new Error('Base64 decoder is unavailable in this environment.');
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof globalThis.btoa === 'function') {
    const CHUNK = 0x8000;
    const chunks: string[] = [];
    for (let i = 0; i < bytes.length; i += CHUNK) {
      const slice = bytes.subarray(i, Math.min(i + CHUNK, bytes.length));
      chunks.push(String.fromCharCode(...slice));
    }
    return globalThis.btoa(chunks.join(''));
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  throw new Error('Base64 encoder is unavailable in this environment.');
}

export function dataUrlToBytes(dataUrl: string): {
  bytes: Uint8Array;
  mimeType: string;
} {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    throw new Error('Invalid Data URL provided.');
  }
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) {
    throw new Error('Malformed Data URL: missing comma separator.');
  }
  const header = dataUrl.slice(5, commaIdx);
  const payload = dataUrl.slice(commaIdx + 1);
  const parts = header.split(';').filter(Boolean);
  const isBase64 = parts.some((p) => p.toLowerCase() === 'base64');
  const mimeType =
    parts.find((p) => p.includes('/'))?.toLowerCase() ||
    'application/octet-stream';

  if (isBase64) {
    return {
      bytes: base64ToBytes(payload),
      mimeType,
    };
  }

  // Handle non-base64 UTF-8 SVG / URL-encoded data URLs
  let decodedText = payload;
  try {
    decodedText = decodeURIComponent(payload);
  } catch {
    decodedText = payload;
  }
  const encoder = new TextEncoder();
  return {
    bytes: encoder.encode(decodedText),
    mimeType,
  };
}

export function bytesToDataUrl(bytes: Uint8Array, mimeType: string): string {
  const safeMime = (mimeType || 'application/octet-stream').trim();
  const b64 = bytesToBase64(bytes);
  return `data:${safeMime};base64,${b64}`;
}

export function getFileExtensionFromMime(mimeType: string): string {
  const clean = (mimeType || '').toLowerCase();
  if (clean.includes('png')) return 'png';
  if (clean.includes('jpeg') || clean.includes('jpg')) return 'jpg';
  if (clean.includes('webp')) return 'webp';
  if (clean.includes('svg')) return 'svg';
  if (clean.includes('pdf')) return 'pdf';
  return 'bin';
}

// ============================================================================
// Repositories: IndexedDB (Browser) + Memory (Node Tests / Fallback)
// ============================================================================
function normalizeStoredBytes(raw: unknown): Uint8Array {
  if (raw instanceof Uint8Array) {
    return new Uint8Array(raw);
  }
  if (raw instanceof ArrayBuffer) {
    return new Uint8Array(raw);
  }
  if (ArrayBuffer.isView(raw)) {
    return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
  }
  if (Array.isArray(raw)) {
    return new Uint8Array(raw);
  }
  return new Uint8Array(0);
}

export function createMemoryTeacherMediaRepository(
  seed?: StoredMediaBlobRecord[]
): TeacherMediaRepository {
  const store = new Map<string, StoredMediaBlobRecord>();
  if (seed) {
    for (const item of seed) {
      store.set(item.blobKey, {
        ...item,
        bytes: new Uint8Array(item.bytes),
      });
    }
  }

  return {
    async getBlob(blobKey) {
      const found = store.get(blobKey);
      if (!found) return null;
      return {
        ...found,
        bytes: new Uint8Array(found.bytes),
      };
    },
    async putBlob(record) {
      store.set(record.blobKey, {
        ...record,
        bytes: new Uint8Array(record.bytes),
      });
    },
    async deleteBlob(blobKey) {
      return store.delete(blobKey);
    },
    async listBlobKeys() {
      return Array.from(store.keys());
    },
    async countBlobs() {
      return store.size;
    },
  };
}

function openTeacherMediaIndexedDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable in this environment.'));
      return;
    }
    const req = indexedDB.open(TEACHER_MEDIA_DB_NAME, TEACHER_MEDIA_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(TEACHER_MEDIA_STORE_NAME)) {
        const os = db.createObjectStore(TEACHER_MEDIA_STORE_NAME, {
          keyPath: 'blobKey',
        });
        os.createIndex('contentSha256', 'contentSha256', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () =>
      reject(req.error ?? new Error('Failed to open teacher media IndexedDB.'));
  });
}

export function createIndexedDbTeacherMediaRepository(): TeacherMediaRepository {
  return {
    async getBlob(blobKey) {
      const db = await openTeacherMediaIndexedDb();
      try {
        return await new Promise<StoredMediaBlobRecord | null>(
          (resolve, reject) => {
            const tx = db.transaction(TEACHER_MEDIA_STORE_NAME, 'readonly');
            const store = tx.objectStore(TEACHER_MEDIA_STORE_NAME);
            const req = store.get(blobKey);
            req.onsuccess = () => {
              const raw = req.result as
                | (Omit<StoredMediaBlobRecord, 'bytes'> & { bytes: unknown })
                | undefined;
              if (!raw) {
                resolve(null);
                return;
              }
              resolve({
                blobKey: raw.blobKey,
                bytes: normalizeStoredBytes(raw.bytes),
                contentSha256: raw.contentSha256,
                crc32: Number(raw.crc32) >>> 0,
                mimeType: raw.mimeType,
                fileName: raw.fileName,
                byteLength: Number(raw.byteLength),
                createdAt: raw.createdAt,
              });
            };
            req.onerror = () =>
              reject(req.error ?? new Error('Failed to read blob from IndexedDB.'));
          }
        );
      } finally {
        db.close();
      }
    },

    async putBlob(record) {
      const db = await openTeacherMediaIndexedDb();
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(TEACHER_MEDIA_STORE_NAME, 'readwrite');
          const store = tx.objectStore(TEACHER_MEDIA_STORE_NAME);
          const payload: StoredMediaBlobRecord = {
            ...record,
            bytes: new Uint8Array(record.bytes),
          };
          const req = store.put(payload);
          req.onsuccess = () => resolve();
          req.onerror = () =>
            reject(req.error ?? new Error('Failed to write blob to IndexedDB.'));
        });
      } finally {
        db.close();
      }
    },

    async deleteBlob(blobKey) {
      const db = await openTeacherMediaIndexedDb();
      try {
        return await new Promise<boolean>((resolve, reject) => {
          const tx = db.transaction(TEACHER_MEDIA_STORE_NAME, 'readwrite');
          const store = tx.objectStore(TEACHER_MEDIA_STORE_NAME);
          const checkReq = store.getKey(blobKey);
          checkReq.onsuccess = () => {
            const exists = checkReq.result !== undefined;
            if (!exists) {
              resolve(false);
              return;
            }
            const delReq = store.delete(blobKey);
            delReq.onsuccess = () => resolve(true);
            delReq.onerror = () =>
              reject(delReq.error ?? new Error('Failed to delete blob.'));
          };
          checkReq.onerror = () =>
            reject(checkReq.error ?? new Error('Failed to check blob key.'));
        });
      } finally {
        db.close();
      }
    },

    async listBlobKeys() {
      const db = await openTeacherMediaIndexedDb();
      try {
        return await new Promise<string[]>((resolve, reject) => {
          const tx = db.transaction(TEACHER_MEDIA_STORE_NAME, 'readonly');
          const store = tx.objectStore(TEACHER_MEDIA_STORE_NAME);
          const req = store.getAllKeys();
          req.onsuccess = () =>
            resolve((req.result || []).map((k) => String(k)));
          req.onerror = () =>
            reject(req.error ?? new Error('Failed to list blob keys.'));
        });
      } finally {
        db.close();
      }
    },

    async countBlobs() {
      const db = await openTeacherMediaIndexedDb();
      try {
        return await new Promise<number>((resolve, reject) => {
          const tx = db.transaction(TEACHER_MEDIA_STORE_NAME, 'readonly');
          const store = tx.objectStore(TEACHER_MEDIA_STORE_NAME);
          const req = store.count();
          req.onsuccess = () => resolve(Number(req.result || 0));
          req.onerror = () =>
            reject(req.error ?? new Error('Failed to count blobs.'));
        });
      } finally {
        db.close();
      }
    },
  };
}

let sharedFallbackMemoryRepo: TeacherMediaRepository | null = null;

export function getDefaultTeacherMediaRepository(): TeacherMediaRepository {
  if (typeof indexedDB !== 'undefined') {
    return createIndexedDbTeacherMediaRepository();
  }
  if (!sharedFallbackMemoryRepo) {
    sharedFallbackMemoryRepo = createMemoryTeacherMediaRepository();
  }
  return sharedFallbackMemoryRepo;
}

// ============================================================================
// Deduplicated Storage & CRC-32 / SHA-256 Read-Back Integrity Verification
// ============================================================================
export async function saveMediaBytes(
  input: SaveMediaInput,
  repo: TeacherMediaRepository = getDefaultTeacherMediaRepository()
): Promise<SaveMediaResult> {
  const bytes = new Uint8Array(input.bytes);
  const contentSha256 = await computeSha256Hex(bytes);
  const crc32 = computeCrc32(bytes);
  const blobKey = `sha256:${contentSha256}`;
  const nowIso = input.createdAt || new Date().toISOString();
  const ext = getFileExtensionFromMime(input.mimeType);
  const safeFileName =
    input.fileName?.trim() || `evidence-${contentSha256.slice(0, 10)}.${ext}`;
  const refId =
    input.id?.trim() ||
    `mref-${contentSha256.slice(0, 8)}-${Date.now().toString(36)}`;

  const existing = await repo.getBlob(blobKey);
  if (
    existing &&
    existing.byteLength === bytes.byteLength &&
    existing.crc32 === crc32 &&
    existing.contentSha256 === contentSha256
  ) {
    return {
      deduplicated: true,
      mediaRef: {
        id: refId,
        blobKey,
        contentSha256,
        crc32,
        fileName: safeFileName,
        mimeType: input.mimeType || existing.mimeType,
        byteLength: bytes.byteLength,
        createdAt: existing.createdAt || nowIso,
        sourceTag: input.sourceTag,
      },
    };
  }

  const record: StoredMediaBlobRecord = {
    blobKey,
    bytes,
    contentSha256,
    crc32,
    mimeType: input.mimeType || 'application/octet-stream',
    fileName: safeFileName,
    byteLength: bytes.byteLength,
    createdAt: nowIso,
  };

  await repo.putBlob(record);

  return {
    deduplicated: false,
    mediaRef: {
      id: refId,
      blobKey,
      contentSha256,
      crc32,
      fileName: safeFileName,
      mimeType: record.mimeType,
      byteLength: record.byteLength,
      createdAt: nowIso,
      sourceTag: input.sourceTag,
    },
  };
}

export async function saveMediaDataUrl(
  input: {
    dataUrl: string;
    fileName?: string;
    id?: string;
    sourceTag?: UnifiedMediaRef['sourceTag'];
    createdAt?: string;
  },
  repo: TeacherMediaRepository = getDefaultTeacherMediaRepository()
): Promise<SaveMediaResult> {
  const { bytes, mimeType } = dataUrlToBytes(input.dataUrl);
  const ext = getFileExtensionFromMime(mimeType);
  return saveMediaBytes(
    {
      bytes,
      mimeType,
      fileName: input.fileName || `evidence.${ext}`,
      id: input.id,
      sourceTag: input.sourceTag,
      createdAt: input.createdAt,
    },
    repo
  );
}

export async function loadMediaBlobWithIntegrityCheck(
  blobKey: string,
  expectedRef?: Partial<UnifiedMediaRef>,
  repo: TeacherMediaRepository = getDefaultTeacherMediaRepository()
): Promise<LoadMediaResult> {
  try {
    const record = await repo.getBlob(blobKey);
    if (!record) {
      return {
        ok: false,
        reason: 'missing',
        integrityError: `المرفق غير موجود في مستودع الوسائط (${blobKey}).`,
      };
    }

    const bytes = normalizeStoredBytes(record.bytes);
    const actualByteLength = bytes.byteLength;
    const actualCrc32 = computeCrc32(bytes);
    const actualSha256 = await computeSha256Hex(bytes);

    const expectedSha = expectedRef?.contentSha256 || record.contentSha256;
    const expectedCrc =
      expectedRef?.crc32 !== undefined ? expectedRef.crc32 >>> 0 : record.crc32 >>> 0;
    const expectedLen =
      expectedRef?.byteLength !== undefined
        ? expectedRef.byteLength
        : record.byteLength;

    if (actualByteLength !== expectedLen) {
      return {
        ok: false,
        reason: 'corrupted',
        integrityError: `تلف في حجم المرفق (${actualByteLength} بايت بدل ${expectedLen} بايت).`,
      };
    }

    if (actualCrc32 !== expectedCrc) {
      return {
        ok: false,
        reason: 'corrupted',
        integrityError: `فشل التحقق من سلامة CRC-32 للمرفق (${actualCrc32} !== ${expectedCrc}).`,
      };
    }

    if (actualSha256 !== expectedSha || `sha256:${actualSha256}` !== blobKey) {
      return {
        ok: false,
        reason: 'corrupted',
        integrityError: `فشل التحقق من بصمة SHA-256 للمرفق (${blobKey}).`,
      };
    }

    const mimeType = expectedRef?.mimeType || record.mimeType || 'image/png';
    return {
      ok: true,
      record: {
        ...record,
        bytes,
      },
      dataUrl: bytesToDataUrl(bytes, mimeType),
    };
  } catch (err) {
    return {
      ok: false,
      reason: 'io-error',
      integrityError:
        err instanceof Error ? err.message : 'تعذر قراءة المرفق من IndexedDB.',
    };
  }
}

// ============================================================================
// Global Reference Counting & Safe Orphan Deletion
// ============================================================================
function extractBlobKeysFromUnknownStore(
  parsed: unknown,
  counts: Map<string, number>
): void {
  if (!parsed || typeof parsed !== 'object') return;
  const obj = parsed as Record<string, unknown>;

  const bump = (key: unknown) => {
    if (typeof key === 'string' && key.startsWith('sha256:')) {
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  };

  const scanMediaRefsArray = (mediaRefs: unknown) => {
    if (!Array.isArray(mediaRefs)) return;
    for (const ref of mediaRefs) {
      if (ref && typeof ref === 'object') {
        bump((ref as Record<string, unknown>).blobKey);
      }
    }
  };

  const scanRecordMap = (mapObj: unknown) => {
    if (!mapObj || typeof mapObj !== 'object') return;
    for (const rec of Object.values(mapObj as Record<string, unknown>)) {
      if (rec && typeof rec === 'object') {
        scanMediaRefsArray((rec as Record<string, unknown>).mediaRefs);
      }
    }
  };

  // Standard TeacherGroupArchiveStore shape: { records, activeDraftByFormId }
  scanRecordMap(obj.records);
  scanRecordMap(obj.activeDraftByFormId);

  // Unified Portfolio Store shape: elements[*].standaloneEvidences[*].mediaRefs
  if (obj.elements && typeof obj.elements === 'object') {
    for (const el of Object.values(obj.elements as Record<string, unknown>)) {
      if (!el || typeof el !== 'object') continue;
      const standalone = (el as Record<string, unknown>).standaloneEvidences;
      if (Array.isArray(standalone)) {
        for (const item of standalone) {
          if (item && typeof item === 'object') {
            scanMediaRefsArray((item as Record<string, unknown>).mediaRefs);
          }
        }
      }
    }
  }
}

export function collectAllTeacherArchiveBlobReferences(
  storage?: Pick<Storage, 'getItem'>,
  extraStorageKeys: readonly string[] = []
): Map<string, number> {
  const counts = new Map<string, number>();
  const store =
    storage ??
    (typeof window !== 'undefined' ? window.localStorage : undefined);
  if (!store) return counts;

  const keys = Array.from(
    new Set([...TEACHER_ARCHIVE_KNOWN_STORAGE_KEYS, ...extraStorageKeys])
  );

  for (const key of keys) {
    try {
      const raw = store.getItem(key);
      if (!raw) continue;
      extractBlobKeysFromUnknownStore(JSON.parse(raw), counts);
    } catch {
      // Ignore malformed JSON store entry
    }
  }
  return counts;
}

export function countBlobReferences(
  blobKey: string,
  opts?: {
    storage?: Pick<Storage, 'getItem'>;
    extraStorageKeys?: readonly string[];
    extraActiveRefs?: Iterable<string | UnifiedMediaRef>;
  }
): number {
  const archiveCounts = collectAllTeacherArchiveBlobReferences(
    opts?.storage,
    opts?.extraStorageKeys
  );
  let total = archiveCounts.get(blobKey) || 0;

  if (opts?.extraActiveRefs) {
    for (const item of opts.extraActiveRefs) {
      const key = typeof item === 'string' ? item : item.blobKey;
      if (key === blobKey) {
        total += 1;
      }
    }
  }
  return total;
}

export async function deleteBlobIfUnreferenced(
  blobKey: string,
  opts?: {
    storage?: Pick<Storage, 'getItem'>;
    extraStorageKeys?: readonly string[];
    extraActiveRefs?: Iterable<string | UnifiedMediaRef>;
    repo?: TeacherMediaRepository;
  }
): Promise<{ deleted: boolean; remainingRefs: number }> {
  const remainingRefs = countBlobReferences(blobKey, opts);
  if (remainingRefs > 0) {
    return { deleted: false, remainingRefs };
  }
  const repo = opts?.repo ?? getDefaultTeacherMediaRepository();
  const deleted = await repo.deleteBlob(blobKey);
  return { deleted, remainingRefs: 0 };
}
