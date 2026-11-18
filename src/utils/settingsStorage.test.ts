import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_SCHOOL_SETTINGS, SETTINGS_STORAGE_KEY } from '../data/defaultSettings';
import { SECTIONS } from '../data/sections';
import { getFormsForSection } from '../forms/registry';
import {
  clearSettingsInStorage,
  getGenderedLabels,
  getRoleForSection,
  loadSettingsFromStorage,
  pageToHash,
  parseHashToPage,
  sanitizeSchoolSettings,
  saveSettingsToStorage,
  validateSchoolSettings,
} from './settingsStorage';

function createMemoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, val: string) => {
      map.set(key, val);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
  };
}

test('DEFAULT_SCHOOL_SETTINGS is completely empty on first run with no personal data and defaults gender to male', () => {
  assert.equal(DEFAULT_SCHOOL_SETTINGS.schoolName, '');
  assert.equal(DEFAULT_SCHOOL_SETTINGS.educationDepartment, '');
  assert.equal(DEFAULT_SCHOOL_SETTINGS.principalName, '');
  assert.equal(DEFAULT_SCHOOL_SETTINGS.userName, '');
  assert.equal(DEFAULT_SCHOOL_SETTINGS.academicYear, '');
  assert.equal(DEFAULT_SCHOOL_SETTINGS.gender, 'male');
  assert.equal(DEFAULT_SCHOOL_SETTINGS.roles.professionalDevelopment, '');
  assert.equal(DEFAULT_SCHOOL_SETTINGS.roles.gifted, '');
  assert.equal(DEFAULT_SCHOOL_SETTINGS.roles.teacher, '');
});

test('getGenderedLabels returns distinct official wording for male (معلم) and female (معلمة) without dual slashes', () => {
  const maleLabels = getGenderedLabels('male');
  assert.equal(maleLabels.honorific, 'الأستاذ');
  assert.equal(maleLabels.trainerExecutedPhrase, 'قد نفذ البرنامج التدريبي');
  assert.equal(maleLabels.traineeAttendedPhrase, 'قد حضر البرنامج التدريبي');
  assert.equal(maleLabels.principalTitle, 'مدير المدرسة');

  const femaleLabels = getGenderedLabels('female');
  assert.equal(femaleLabels.honorific, 'الأستاذة');
  assert.equal(femaleLabels.trainerExecutedPhrase, 'قد نفذت البرنامج التدريبي');
  assert.equal(femaleLabels.traineeAttendedPhrase, 'قد حضرت البرنامج التدريبي');
  assert.equal(femaleLabels.principalTitle, 'مديرة المدرسة');
});

test('validateSchoolSettings allows saving empty or partially filled settings', () => {
  const emptyCheck = validateSchoolSettings(DEFAULT_SCHOOL_SETTINGS);
  assert.equal(emptyCheck.valid, true);
  assert.deepEqual(emptyCheck.errors, {});

  const partialSettings = {
    ...DEFAULT_SCHOOL_SETTINGS,
    schoolName: 'مدرسة تجريبية',
    roles: {
      ...DEFAULT_SCHOOL_SETTINGS.roles,
      teacher: 'معلم مادة',
    },
  };
  const partialCheck = validateSchoolSettings(partialSettings);
  assert.equal(partialCheck.valid, true);
  assert.deepEqual(partialCheck.errors, {});
});

test('saveSettingsToStorage, loadSettingsFromStorage, and clearSettingsInStorage preserve local data and reset to empty', () => {
  const userAStorage = createMemoryStorage();
  const userBStorage = createMemoryStorage();

  // Initial load returns empty defaults
  const initialA = loadSettingsFromStorage(userAStorage);
  assert.deepEqual(initialA, DEFAULT_SCHOOL_SETTINGS);

  // User A saves partial settings
  const updatedA = {
    ...DEFAULT_SCHOOL_SETTINGS,
    schoolName: 'مدرسة المستخدم الأول',
    academicYear: '1448-1449',
    roles: {
      ...DEFAULT_SCHOOL_SETTINGS.roles,
      teacher: 'معلم العلوم',
    },
  };
  const saved = saveSettingsToStorage(updatedA, userAStorage);
  assert.equal(saved, true);
  assert.ok(userAStorage.getItem(SETTINGS_STORAGE_KEY));

  // User A loads their saved settings (including empty fields)
  const loadedA = loadSettingsFromStorage(userAStorage);
  assert.equal(loadedA.schoolName, 'مدرسة المستخدم الأول');
  assert.equal(loadedA.academicYear, '1448-1449');
  assert.equal(loadedA.roles.teacher, 'معلم العلوم');
  assert.equal(loadedA.roles.professionalDevelopment, '');

  // User B on another browser/device still gets completely empty settings
  const loadedB = loadSettingsFromStorage(userBStorage);
  assert.deepEqual(loadedB, DEFAULT_SCHOOL_SETTINGS);

  // Resetting User A restores empty defaults
  const afterClearA = clearSettingsInStorage(userAStorage);
  assert.deepEqual(afterClearA, DEFAULT_SCHOOL_SETTINGS);
  assert.equal(userAStorage.getItem(SETTINGS_STORAGE_KEY), null);
});

test('sanitizeSchoolSettings preserves existing saved local data and defaults missing fields to empty string', () => {
  const recovered = sanitizeSchoolSettings({
    schoolName: 'مدرسة محفوظة مسبقاً',
    roles: { gifted: 'منسق' },
  });
  assert.equal(recovered.schoolName, 'مدرسة محفوظة مسبقاً');
  assert.equal(recovered.roles.gifted, 'منسق');
  assert.equal(recovered.roles.teacher, '');
  assert.equal(recovered.userName, '');
});

test('getRoleForSection returns the distinct role for each section', () => {
  const customSettings = {
    ...DEFAULT_SCHOOL_SETTINGS,
    roles: {
      professionalDevelopment: 'صفة 1',
      gifted: 'صفة 2',
      teacher: 'صفة 3',
    },
  };
  assert.equal(getRoleForSection(customSettings, 'professional-development'), 'صفة 1');
  assert.equal(getRoleForSection(customSettings, 'gifted'), 'صفة 2');
  assert.equal(getRoleForSection(customSettings, 'teacher'), 'صفة 3');
});

test('hash routing helpers parse and format page IDs for GitHub Pages compatibility', () => {
  assert.equal(parseHashToPage(''), 'home');
  assert.equal(parseHashToPage('#/'), 'home');
  assert.equal(parseHashToPage('#/professional-development'), 'professional-development');
  assert.equal(parseHashToPage('#/plc'), 'plc');
  assert.equal(parseHashToPage('#/gifted'), 'gifted');
  assert.equal(parseHashToPage('#/teacher'), 'teacher');
  assert.equal(parseHashToPage('#/settings'), 'settings');
  assert.equal(parseHashToPage('#/unknown'), 'home');

  assert.equal(pageToHash('home'), '#/');
  assert.equal(pageToHash('plc'), '#/plc');
  assert.equal(pageToHash('settings'), '#/settings');
});

test('reportFieldHeaderColor setting is completely removed from defaults and stripped when loading legacy storage', () => {
  assert.equal('reportFieldHeaderColor' in DEFAULT_SCHOOL_SETTINGS, false);

  const sanitized = sanitizeSchoolSettings({
    schoolName: 'مدرسة النور',
    reportFieldHeaderColor: 'green',
  });
  assert.equal(sanitized.schoolName, 'مدرسة النور');
  assert.equal('reportFieldHeaderColor' in sanitized, false);

  const store = createMemoryStorage();
  saveSettingsToStorage(
    {
      ...DEFAULT_SCHOOL_SETTINGS,
      schoolName: 'مدرسة الأفق',
    },
    store
  );
  const loaded = loadSettingsFromStorage(store);
  assert.equal('reportFieldHeaderColor' in loaded, false);
  assert.equal(loaded.schoolName, 'مدرسة الأفق');
});

test('structural separation: professional-development has 4 forms, plc is independent (#/plc), and teacher has 7 groups only', () => {
  // 1. Professional development forms registry has the 4 original forms
  const pdForms = getFormsForSection('professional-development');
  assert.equal(pdForms.length, 4);
  assert.deepEqual(
    pdForms.map((f) => f.id),
    [
      'pd-training-execution-report',
      'pd-semester-final-report',
      'pd-trainer-certificate',
      'pd-trainee-certificate',
    ]
  );

  // 2. Professional development description does not claim PLC is inside it
  assert.ok(!SECTIONS['professional-development'].shortDescription.includes('مجتمعات التعلم المهنية'));
  assert.ok(!SECTIONS['professional-development'].shortDescription.includes('مجتمعات التعلّم المهنية'));

  // 3. SectionPage.tsx does not override professional-development with PlcSectionHub
  const sectionPageSource = fs.readFileSync(
    path.join(process.cwd(), 'src/pages/SectionPage.tsx'),
    'utf8'
  );
  assert.ok(!sectionPageSource.includes('PlcSectionHub'));

  // 4. App.tsx mounts PlcSectionHub on currentPage === 'plc'
  const appSource = fs.readFileSync(
    path.join(process.cwd(), 'src/App.tsx'),
    'utf8'
  );
  assert.ok(appSource.includes("currentPage === 'plc'"));
  assert.ok(appSource.includes('<PlcSectionHub />'));

  // 5. TeacherSectionHub.tsx does not include Group 8 (plc-hub / PlcSectionHub)
  const teacherHubSource = fs.readFileSync(
    path.join(process.cwd(), 'src/components/teacher/TeacherSectionHub.tsx'),
    'utf8'
  );
  assert.ok(!teacherHubSource.includes('PlcSectionHub'));
  assert.ok(!teacherHubSource.includes('plc-hub'));
  assert.ok(!teacherHubSource.includes('teacher-group-card-plc'));
});

test('central SchoolSettings semester supports strictly two options (الفصل الدراسي الأول and الفصل الدراسي الثاني) with no third semester', () => {
  assert.equal(DEFAULT_SCHOOL_SETTINGS.semester, 'الفصل الدراسي الأول');
  const store = createMemoryStorage();
  saveSettingsToStorage(
    {
      ...DEFAULT_SCHOOL_SETTINGS,
      academicYear: '1447 هـ',
      semester: 'الفصل الدراسي الثاني',
    },
    store
  );
  const loaded = loadSettingsFromStorage(store);
  assert.equal(loaded.academicYear, '1447 هـ');
  assert.equal(loaded.semester, 'الفصل الدراسي الثاني');

  // Invalid or third semester values fall back safely to الفصل الدراسي الأول
  const sanitizedInvalid = sanitizeSchoolSettings({
    semester: 'الفصل الدراسي الثالث',
  });
  assert.equal(sanitizedInvalid.semester, 'الفصل الدراسي الأول');
});



