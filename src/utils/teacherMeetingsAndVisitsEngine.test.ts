import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SCHOOL_SETTINGS } from '../data/defaultSettings';
import {
  TEACHER_MEETINGS_AND_VISITS_CATALOG,
  MAX_MEETING_ATTENDEES,
  createInitialMeetingOrVisitState,
  createSampleMeetingOrVisitState,
  parseBulkAttendeeNames,
  validateMeetingOrVisitState,
  buildTeacherMeetingOrVisitDocument,
  MeetingMinutesFormState,
  PeerVisitReportFormState,
} from './teacherMeetingsAndVisitsEngine';
import {
  paginateTeacherReportBlocks,
  createDefaultSampleEvidencePhotos,
} from './teacherPdfEngine';

const TEST_SETTINGS = {
  ...DEFAULT_SCHOOL_SETTINGS,
  schoolName: 'مدرسة الفيصلية المتوسطة',
  educationDepartment: 'إدارة التعليم بمنطقة الرياض',
  principalName: 'سعد بن عبدالله الغامدي',
  userName: 'أحمد بن محمد العتيبي',
  academicYear: '١٤٤٧هـ',
};

describe('teacherMeetingsAndVisitsEngine', () => {
  it('defines the 2 approved models for Meetings and Visits without المزار', () => {
    assert.equal(TEACHER_MEETINGS_AND_VISITS_CATALOG.length, 2);
    assert.equal(TEACHER_MEETINGS_AND_VISITS_CATALOG[0].id, 'meeting-minutes');
    assert.equal(TEACHER_MEETINGS_AND_VISITS_CATALOG[1].id, 'peer-visit-report');
    assert.ok(!TEACHER_MEETINGS_AND_VISITS_CATALOG[1].description.includes('المزار'));
  });

  it('validates empty Meeting Minutes state and passes sample state', () => {
    const emptyState = createInitialMeetingOrVisitState('meeting-minutes', TEST_SETTINGS);
    const emptyErrors = validateMeetingOrVisitState(emptyState);
    assert.ok(emptyErrors.length > 0);

    const sampleState = createSampleMeetingOrVisitState('meeting-minutes', TEST_SETTINGS);
    const sampleErrors = validateMeetingOrVisitState(sampleState);
    assert.equal(sampleErrors.length, 0);
  });

  it('validates empty Peer Visit state and passes sample state', () => {
    const emptyState = createInitialMeetingOrVisitState('peer-visit-report', TEST_SETTINGS);
    const emptyErrors = validateMeetingOrVisitState(emptyState);
    assert.ok(emptyErrors.length > 0);

    const sampleState = createSampleMeetingOrVisitState('peer-visit-report', TEST_SETTINGS);
    const sampleErrors = validateMeetingOrVisitState(sampleState);
    assert.equal(sampleErrors.length, 0);
  });

  it('parses bulk pasted attendee names cleanly and enforces MAX_MEETING_ATTENDEES (30)', () => {
    const pastedText = `
      1. إبراهيم غرم الله الغامدي
      2 - خالد بن سعد الدوسري
      • فهد بن عبدالله الحربي
      
      4) سعيد بن محمد القحطاني
    `;
    const parsed = parseBulkAttendeeNames(pastedText);
    assert.deepEqual(parsed, [
      'إبراهيم غرم الله الغامدي',
      'خالد بن سعد الدوسري',
      'فهد بن عبدالله الحربي',
      'سعيد بن محمد القحطاني',
    ]);

    const fortyNames = Array.from({ length: 40 }, (_, i) => `معلم رقم ${i + 1}`).join('\n');
    const capped = parseBulkAttendeeNames(fortyNames);
    assert.equal(capped.length, MAX_MEETING_ATTENDEES);
    assert.equal(MAX_MEETING_ATTENDEES, 30);
  });

  it('Cases 1–4: Meeting Minutes supports (no evidence/links), (photos only), (links only), and (photos + links together) with proper pagination before attendance sheet', () => {
    const baseState = createSampleMeetingOrVisitState(
      'meeting-minutes',
      TEST_SETTINGS
    ) as MeetingMinutesFormState;
    const samplePhotos = createDefaultSampleEvidencePhotos('green');
    const sampleLinks = [
      { id: 'mm-l1', url: 'https://moe.gov.sa/ar/education/Pages/default.aspx' },
      { id: 'mm-l2', url: 'https://ien.edu.sa/' },
    ];

    // Case 1: No photos, no links
    const doc1 = buildTeacherMeetingOrVisitDocument(
      { ...baseState, evidencePhotos: [], evidenceLinks: [] },
      TEST_SETTINGS
    );
    const pages1 = paginateTeacherReportBlocks(doc1, TEST_SETTINGS);
    assert.ok(!pages1.some((p) => p.blocks.some((b) => b.kind === 'evidence')));
    assert.equal(pages1.length, 2); // Page 1: minutes + principal signoff; Page 2: attendance table

    // Case 2: Photos only
    const doc2 = buildTeacherMeetingOrVisitDocument(
      { ...baseState, evidencePhotos: [samplePhotos[0], samplePhotos[1]], evidenceLinks: [] },
      TEST_SETTINGS
    );
    const pages2 = paginateTeacherReportBlocks(doc2, TEST_SETTINGS);
    const evBlock2 = pages2.flatMap((p) => p.blocks).find((b) => b.kind === 'evidence');
    assert.ok(evBlock2 && evBlock2.kind === 'evidence');
    assert.equal(evBlock2.photos.length, 2);
    assert.equal(evBlock2.links.length, 0);
    // Ensure last page is still the independent attendance table
    const lastPage2 = pages2[pages2.length - 1];
    assert.ok(
      lastPage2.blocks.some(
        (b) => b.kind === 'section' && b.section.id === 'mm-attendance-sheet-section'
      )
    );

    // Case 3: Links only
    const doc3 = buildTeacherMeetingOrVisitDocument(
      { ...baseState, evidencePhotos: [], evidenceLinks: sampleLinks },
      TEST_SETTINGS
    );
    const pages3 = paginateTeacherReportBlocks(doc3, TEST_SETTINGS);
    const evBlock3 = pages3.flatMap((p) => p.blocks).find((b) => b.kind === 'evidence');
    assert.ok(evBlock3 && evBlock3.kind === 'evidence');
    assert.equal(evBlock3.photos.length, 0);
    assert.equal(evBlock3.links.length, 2);

    // Case 4: Photos and Links together
    const doc4 = buildTeacherMeetingOrVisitDocument(
      {
        ...baseState,
        evidencePhotos: [samplePhotos[0], samplePhotos[1]],
        evidenceLinks: sampleLinks,
      },
      TEST_SETTINGS
    );
    const pages4 = paginateTeacherReportBlocks(doc4, TEST_SETTINGS);
    const evBlock4 = pages4.flatMap((p) => p.blocks).find((b) => b.kind === 'evidence');
    assert.ok(evBlock4 && evBlock4.kind === 'evidence');
    assert.equal(evBlock4.photos.length, 2);
    assert.equal(evBlock4.links.length, 2);
  });

  it('splits Meeting Minutes attendance table across multiple pages when > 15 names (up to 30 names)', () => {
    const sample = createSampleMeetingOrVisitState(
      'meeting-minutes',
      TEST_SETTINGS
    ) as MeetingMinutesFormState;
    sample.attendees = Array.from({ length: 28 }, (_, idx) => ({
      id: `att-${idx + 1}`,
      attendeeName: `المعلم المشارك رقم ${idx + 1}`,
    }));

    const doc = buildTeacherMeetingOrVisitDocument(sample, TEST_SETTINGS);
    const pages = paginateTeacherReportBlocks(doc, TEST_SETTINGS);

    // Page 1: main meeting minutes (with Principal sign-off)
    // Page 2: attendance rows 1..15
    // Page 3: attendance rows 16..28
    assert.equal(pages.length, 3);
    assert.ok(pages[0].blocks.some((b) => b.kind === 'signoff'));
    assert.ok(!pages[1].blocks.some((b) => b.kind === 'signoff'));
    assert.ok(!pages[2].blocks.some((b) => b.kind === 'signoff'));

    const page2SecBlock = pages[1].blocks.find((b) => b.kind === 'section');
    const page3SecBlock = pages[2].blocks.find((b) => b.kind === 'section');
    assert.ok(page2SecBlock && page2SecBlock.kind === 'section');
    assert.ok(page3SecBlock && page3SecBlock.kind === 'section');

    const page2Table = page2SecBlock.section;
    const page3Table = page3SecBlock.section;
    assert.equal(page2Table.type, 'attendance-table');
    assert.equal(page2Table.attendanceRows?.length, 15);
    assert.equal(page2Table.attendanceRows?.[0].index, 1);
    assert.equal(page2Table.attendanceRows?.[14].index, 15);

    assert.equal(page3Table.type, 'attendance-table');
    assert.equal(page3Table.title, 'كشف الحضور والتوقيعات (يتبع)');
    assert.equal(page3Table.attendanceRows?.length, 13);
    assert.equal(page3Table.attendanceRows?.[0].index, 16);
    assert.equal(page3Table.attendanceRows?.[12].index, 28);
  });

  it('Cases 5–8: Peer Visit Report supports (no signatures & no links), (signatures only), (links only), and (signatures + links together) without المزار', () => {
    const baseState = createSampleMeetingOrVisitState(
      'peer-visit-report',
      TEST_SETTINGS
    ) as PeerVisitReportFormState;
    const sampleLinks = [
      { id: 'pv-l1', url: 'https://moe.gov.sa/ar/education/Pages/default.aspx' },
      { id: 'pv-l2', url: 'https://ien.edu.sa/' },
    ];

    // Case 5: No signatures, no links
    const doc5 = buildTeacherMeetingOrVisitDocument(
      {
        ...baseState,
        enableTeacherSignatures: false,
        evidencePhotos: [],
        evidenceLinks: [],
      },
      TEST_SETTINGS
    );
    const serialized5 = JSON.stringify(doc5);
    assert.ok(!serialized5.includes('المزار'));
    assert.ok(!serialized5.includes('توقيع المعلم'));
    assert.ok(!doc5.sections.some((s) => s.id === 'pv-teacher-signatures-section'));
    const pages5 = paginateTeacherReportBlocks(doc5, TEST_SETTINGS);
    assert.ok(!pages5.some((p) => p.blocks.some((b) => b.kind === 'evidence')));

    // Case 6: Teacher names & signatures enabled only
    const doc6 = buildTeacherMeetingOrVisitDocument(
      {
        ...baseState,
        enableTeacherSignatures: true,
        evidencePhotos: [],
        evidenceLinks: [],
      },
      TEST_SETTINGS
    );
    assert.ok(!JSON.stringify(doc6).includes('المزار'));
    const sigSec6 = doc6.sections.find((s) => s.id === 'pv-teacher-signatures-section');
    assert.ok(sigSec6);
    assert.equal(sigSec6.title, 'أسماء المعلمين والتوقيعات');
    assert.equal(sigSec6.placeAfterEvidence, true);
    assert.deepEqual(
      sigSec6.fields?.map((f) => ({
        label: f.label,
        value: f.value,
        isSignatureSpace: Boolean(f.isSignatureSpace),
      })),
      [
        {
          label: 'المعلم الزائر',
          value: 'أحمد بن محمد العتيبي',
          isSignatureSpace: false,
        },
        {
          label: 'توقيع المعلم الزائر',
          value: '',
          isSignatureSpace: true,
        },
        {
          label: 'المعلم المستضيف',
          value: 'خالد بن سعد الدوسري',
          isSignatureSpace: false,
        },
        {
          label: 'توقيع المعلم المستضيف',
          value: '',
          isSignatureSpace: true,
        },
      ]
    );

    // Case 7: Links only (without signatures)
    const doc7 = buildTeacherMeetingOrVisitDocument(
      {
        ...baseState,
        enableTeacherSignatures: false,
        evidencePhotos: [],
        evidenceLinks: sampleLinks,
      },
      TEST_SETTINGS
    );
    assert.ok(!doc7.sections.some((s) => s.id === 'pv-teacher-signatures-section'));
    const pages7 = paginateTeacherReportBlocks(doc7, TEST_SETTINGS);
    const evBlock7 = pages7.flatMap((p) => p.blocks).find((b) => b.kind === 'evidence');
    assert.ok(evBlock7 && evBlock7.kind === 'evidence');
    assert.equal(evBlock7.photos.length, 0);
    assert.equal(evBlock7.links.length, 2);

    // Case 8: Both Teacher signatures AND Links together
    const doc8 = buildTeacherMeetingOrVisitDocument(
      {
        ...baseState,
        enableTeacherSignatures: true,
        evidencePhotos: [],
        evidenceLinks: sampleLinks,
      },
      TEST_SETTINGS
    );
    const pages8 = paginateTeacherReportBlocks(doc8, TEST_SETTINGS);
    const allBlocks8 = pages8.flatMap((p) => p.blocks);
    const evIdx8 = allBlocks8.findIndex((b) => b.kind === 'evidence');
    const sigIdx8 = allBlocks8.findIndex(
      (b) => b.kind === 'section' && b.section.id === 'pv-teacher-signatures-section'
    );
    const signoffIdx8 = allBlocks8.findIndex((b) => b.kind === 'signoff');
    assert.ok(evIdx8 !== -1);
    assert.ok(sigIdx8 > evIdx8, 'Teacher signatures section should appear after evidence at the end of the report');
    assert.ok(signoffIdx8 > sigIdx8, 'Principal signoff should appear at the very end after teacher signatures');
  });
});
