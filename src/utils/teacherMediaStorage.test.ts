import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  bytesToDataUrl,
  computeSha256Hex,
  computeSha256HexSync,
  countBlobReferences,
  createMemoryTeacherMediaRepository,
  dataUrlToBytes,
  deleteBlobIfUnreferenced,
  loadMediaBlobWithIntegrityCheck,
  saveMediaBytes,
  saveMediaDataUrl,
  TEACHER_MEDIA_DB_NAME,
} from './teacherMediaStorage';
import { computeCrc32 } from './zipBuilder';

function createMemoryStorage(initial?: Record<string, string>) {
  const map = new Map<string, string>(Object.entries(initial || {}));
  return {
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
    removeItem(key: string) {
      map.delete(key);
    },
  };
}

test('teacherMediaStorage uses strictly isolated IndexedDB database name', () => {
  assert.equal(TEACHER_MEDIA_DB_NAME, 'maktabi_teacher_media_db_v1');
  assert.notEqual(TEACHER_MEDIA_DB_NAME, 'maktabi_pd_evidence_db_v1');
  assert.notEqual(TEACHER_MEDIA_DB_NAME, 'maktabi_gifted_evidence_db_v1');
});

test('computeSha256HexSync and computeSha256Hex match Node crypto SHA-256 across binary and Arabic UTF-8 payloads', async () => {
  const binaryPayload = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 1, 2, 3, 255, 128, 64,
  ]);
  const utf8Payload = new TextEncoder().encode(
    'شاهد تعليمي — تقرير تنفيذ استراتيجية تعليمية ٢٠٢٦'
  );

  for (const payload of [new Uint8Array(0), binaryPayload, utf8Payload]) {
    const expected = createHash('sha256').update(payload).digest('hex');
    assert.equal(computeSha256HexSync(payload), expected);
    assert.equal(await computeSha256Hex(payload), expected);
  }
});

test('saveMediaBytes & saveMediaDataUrl deduplicate identical content under single sha256 blobKey', async () => {
  const repo = createMemoryTeacherMediaRepository();
  const sampleBytes = new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80]);

  const first = await saveMediaBytes(
    {
      bytes: sampleBytes,
      fileName: 'evidence-a.png',
      mimeType: 'image/png',
      sourceTag: 'upload',
    },
    repo
  );
  assert.equal(first.deduplicated, false);
  assert.ok(first.mediaRef.blobKey.startsWith('sha256:'));
  assert.equal(first.mediaRef.crc32, computeCrc32(sampleBytes));
  assert.equal(await repo.countBlobs(), 1);

  // Upload exact same bytes as Data URL under a different file name
  const dataUrl = bytesToDataUrl(sampleBytes, 'image/png');
  const second = await saveMediaDataUrl(
    {
      dataUrl,
      fileName: 'duplicate-copy.png',
      sourceTag: 'upload',
    },
    repo
  );
  assert.equal(second.deduplicated, true);
  assert.equal(second.mediaRef.blobKey, first.mediaRef.blobKey);
  assert.equal(second.mediaRef.crc32, first.mediaRef.crc32);
  assert.equal(await repo.countBlobs(), 1);

  // Different content gets stored as a second distinct blob
  const otherBytes = new Uint8Array([10, 20, 30, 40, 50, 60, 70, 81]);
  const third = await saveMediaBytes(
    {
      bytes: otherBytes,
      fileName: 'evidence-b.png',
      mimeType: 'image/png',
    },
    repo
  );
  assert.equal(third.deduplicated, false);
  assert.notEqual(third.mediaRef.blobKey, first.mediaRef.blobKey);
  assert.equal(await repo.countBlobs(), 2);
});

test('loadMediaBlobWithIntegrityCheck verifies SHA-256 & CRC-32 and detects corrupted bytes', async () => {
  const repo = createMemoryTeacherMediaRepository();
  const svgStr = '<svg xmlns="http://www.w3.org/2000/svg"><text>شاهد</text></svg>';
  const svgDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svgStr)}`;

  const { mediaRef } = await saveMediaDataUrl({ dataUrl: svgDataUrl }, repo);
  const okResult = await loadMediaBlobWithIntegrityCheck(
    mediaRef.blobKey,
    mediaRef,
    repo
  );
  assert.equal(okResult.ok, true);
  assert.ok(okResult.dataUrl?.startsWith('data:image/svg+xml;base64,'));
  const decoded = dataUrlToBytes(okResult.dataUrl!);
  assert.equal(new TextDecoder().decode(decoded.bytes), svgStr);

  // Corrupt one byte inside the stored blob
  const rawStored = await repo.getBlob(mediaRef.blobKey);
  assert.ok(rawStored);
  rawStored.bytes[0] = rawStored.bytes[0] ^ 0xff;
  await repo.putBlob(rawStored);

  const corruptedResult = await loadMediaBlobWithIntegrityCheck(
    mediaRef.blobKey,
    mediaRef,
    repo
  );
  assert.equal(corruptedResult.ok, false);
  assert.equal(corruptedResult.reason, 'corrupted');
  assert.ok(corruptedResult.integrityError?.includes('CRC-32'));
});

test('deleteBlobIfUnreferenced preserves shared blobs across archived records and active drafts', async () => {
  const repo = createMemoryTeacherMediaRepository();
  const bytes = new Uint8Array([1, 2, 3, 4, 5, 99]);
  const { mediaRef } = await saveMediaBytes(
    { bytes, fileName: 'shared.jpg', mimeType: 'image/jpeg' },
    repo
  );

  const archiveStoreJson = {
    schemaVersion: 1,
    groupId: 'professional-reports',
    records: {
      trec_1: { id: 'trec_1', mediaRefs: [mediaRef] },
      trec_2: { id: 'trec_2', mediaRefs: [mediaRef] },
    },
    activeDraftByFormId: {
      'strategy-implementation': {
        id: 'tdraft_1',
        mediaRefs: [mediaRef],
      },
    },
  };
  const storage = createMemoryStorage({
    maktabi_teacher_reports_archive_v1: JSON.stringify(archiveStoreJson),
  });

  assert.equal(countBlobReferences(mediaRef.blobKey, { storage }), 3);

  // Attempt delete while still referenced
  const blocked = await deleteBlobIfUnreferenced(mediaRef.blobKey, {
    storage,
    repo,
  });
  assert.equal(blocked.deleted, false);
  assert.equal(blocked.remainingRefs, 3);
  assert.equal(await repo.countBlobs(), 1);

  // Remove trec_1 & trec_2, leaving only draft reference
  delete (archiveStoreJson.records as Record<string, unknown>).trec_1;
  delete (archiveStoreJson.records as Record<string, unknown>).trec_2;
  storage.setItem(
    'maktabi_teacher_reports_archive_v1',
    JSON.stringify(archiveStoreJson)
  );
  const blockedByDraft = await deleteBlobIfUnreferenced(mediaRef.blobKey, {
    storage,
    repo,
  });
  assert.equal(blockedByDraft.deleted, false);
  assert.equal(blockedByDraft.remainingRefs, 1);

  // Remove draft reference -> now orphaned, safe to delete
  archiveStoreJson.activeDraftByFormId = {} as never;
  storage.setItem(
    'maktabi_teacher_reports_archive_v1',
    JSON.stringify(archiveStoreJson)
  );
  const removed = await deleteBlobIfUnreferenced(mediaRef.blobKey, {
    storage,
    repo,
  });
  assert.equal(removed.deleted, true);
  assert.equal(removed.remainingRefs, 0);
  assert.equal(await repo.countBlobs(), 0);
});
