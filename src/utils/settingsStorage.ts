import { DEFAULT_SCHOOL_SETTINGS, SETTINGS_STORAGE_KEY } from '../data/defaultSettings';
import {
  APPROVED_SCHOOL_SEMESTERS,
  ApprovedSchoolSemester,
  PageId,
  SchoolSettings,
  SectionId,
  TeacherPdfColorSystem,
  TeacherPdfTemplateStyle,
  UserGender,
} from '../types';

export { APPROVED_SCHOOL_SEMESTERS };
export type { ApprovedSchoolSemester };

export function normalizeApprovedSemester(val: unknown): ApprovedSchoolSemester {
  if (val === 'الفصل الدراسي الثاني' || val === 'second') {
    return 'الفصل الدراسي الثاني';
  }
  return 'الفصل الدراسي الأول';
}

export interface SettingsValidationResult {
  valid: boolean;
  errors: Partial<Record<string, string>>;
}

export interface GenderedLabels {
  gender: UserGender;
  teacherGeneralRole: string;
  honorific: string;
  trainerExecutedPhrase: string;
  traineeAttendedPhrase: string;
  principalTitle: string;
  trainerLabel: string;
  traineeLabel: string;
}

export function getGenderedLabels(gender?: UserGender): GenderedLabels {
  const isFemale = gender === 'female';
  return {
    gender: isFemale ? 'female' : 'male',
    teacherGeneralRole: isFemale ? 'معلمة' : 'معلم',
    honorific: isFemale ? 'الأستاذة' : 'الأستاذ',
    trainerExecutedPhrase: isFemale
      ? 'قد نفذت البرنامج التدريبي'
      : 'قد نفذ البرنامج التدريبي',
    traineeAttendedPhrase: isFemale
      ? 'قد حضرت البرنامج التدريبي'
      : 'قد حضر البرنامج التدريبي',
    principalTitle: isFemale ? 'مديرة المدرسة' : 'مدير المدرسة',
    trainerLabel: isFemale ? 'اسم المدربة' : 'اسم المدرب',
    traineeLabel: isFemale ? 'اسم المتدربة' : 'اسم المتدرب',
  };
}

export function validateSchoolSettings(_settings: SchoolSettings): SettingsValidationResult {
  return {
    valid: true,
    errors: {},
  };
}

export function sanitizeSchoolSettings(raw: unknown): SchoolSettings {
  if (!raw || typeof raw !== 'object') {
    return structuredClone(DEFAULT_SCHOOL_SETTINGS);
  }

  const candidate = raw as Record<string, unknown>;
  const rawRoles =
    candidate.roles && typeof candidate.roles === 'object'
      ? (candidate.roles as Record<string, unknown>)
      : {};

  const pickString = (val: unknown, fallback: string): string => {
    return typeof val === 'string' ? val.trim() : fallback;
  };

  const gender: UserGender = candidate.gender === 'female' ? 'female' : 'male';
  const semester: ApprovedSchoolSemester = normalizeApprovedSemester(candidate.semester);
  const teacherPdfTemplate: TeacherPdfTemplateStyle =
    candidate.teacherPdfTemplate === 'geometric' ||
    candidate.teacherPdfTemplate === 'waves-2'
      ? candidate.teacherPdfTemplate
      : 'waves';
  const teacherPdfColorSystem: TeacherPdfColorSystem =
    candidate.teacherPdfColorSystem === 'blue' ||
    candidate.teacherPdfColorSystem === 'slate'
      ? candidate.teacherPdfColorSystem
      : 'green';

  return {
    schoolName: pickString(candidate.schoolName, DEFAULT_SCHOOL_SETTINGS.schoolName),
    educationDepartment: pickString(
      candidate.educationDepartment,
      DEFAULT_SCHOOL_SETTINGS.educationDepartment
    ),
    principalName: pickString(candidate.principalName, DEFAULT_SCHOOL_SETTINGS.principalName),
    userName: pickString(candidate.userName, DEFAULT_SCHOOL_SETTINGS.userName),
    academicYear: pickString(candidate.academicYear, DEFAULT_SCHOOL_SETTINGS.academicYear),
    semester,
    gender,
    teacherPdfTemplate,
    teacherPdfColorSystem,
    roles: {
      professionalDevelopment: pickString(
        rawRoles.professionalDevelopment,
        DEFAULT_SCHOOL_SETTINGS.roles.professionalDevelopment
      ),
      gifted: pickString(rawRoles.gifted, DEFAULT_SCHOOL_SETTINGS.roles.gifted),
      teacher: pickString(rawRoles.teacher, DEFAULT_SCHOOL_SETTINGS.roles.teacher),
    },
  };
}

export function loadSettingsFromStorage(storage?: Pick<Storage, 'getItem'>): SchoolSettings {
  try {
    const store = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
    if (!store) {
      return structuredClone(DEFAULT_SCHOOL_SETTINGS);
    }
    const stored = store.getItem(SETTINGS_STORAGE_KEY);
    if (!stored) {
      return structuredClone(DEFAULT_SCHOOL_SETTINGS);
    }
    const parsed = JSON.parse(stored);
    return sanitizeSchoolSettings(parsed);
  } catch {
    return structuredClone(DEFAULT_SCHOOL_SETTINGS);
  }
}

export function saveSettingsToStorage(
  settings: SchoolSettings,
  storage?: Pick<Storage, 'setItem'>
): boolean {
  try {
    const store = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
    if (!store) return false;
    const normalized: SchoolSettings = {
      schoolName: settings.schoolName.trim(),
      educationDepartment: settings.educationDepartment.trim(),
      principalName: settings.principalName.trim(),
      userName: settings.userName.trim(),
      academicYear: settings.academicYear.trim(),
      semester: normalizeApprovedSemester(settings.semester),
      gender: settings.gender === 'female' ? 'female' : 'male',
      teacherPdfTemplate:
        settings.teacherPdfTemplate === 'geometric' ||
        settings.teacherPdfTemplate === 'waves-2'
          ? settings.teacherPdfTemplate
          : 'waves',
      teacherPdfColorSystem:
        settings.teacherPdfColorSystem === 'blue' ||
        settings.teacherPdfColorSystem === 'slate'
          ? settings.teacherPdfColorSystem
          : 'green',
      roles: {
        professionalDevelopment: settings.roles.professionalDevelopment.trim(),
        gifted: settings.roles.gifted.trim(),
        teacher: settings.roles.teacher.trim(),
      },
    };
    store.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
    return true;
  } catch {
    return false;
  }
}

export function clearSettingsInStorage(storage?: Pick<Storage, 'removeItem'>): SchoolSettings {
  try {
    const store = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
    if (store) {
      store.removeItem(SETTINGS_STORAGE_KEY);
    }
  } catch {
    // Ignore storage removal errors
  }
  return structuredClone(DEFAULT_SCHOOL_SETTINGS);
}

export function getRoleForSection(settings: SchoolSettings, sectionId: SectionId): string {
  switch (sectionId) {
    case 'professional-development':
      return settings.roles.professionalDevelopment;
    case 'gifted':
      return settings.roles.gifted;
    case 'teacher':
      return settings.roles.teacher;
  }
}

const VALID_PAGES: PageId[] = [
  'home',
  'professional-development',
  'plc',
  'gifted',
  'teacher',
  'settings',
];

export function parseHashToPage(hash: string): PageId {
  const cleaned = hash.replace(/^#\/?/, '').trim();
  if (VALID_PAGES.includes(cleaned as PageId)) {
    return cleaned as PageId;
  }
  return 'home';
}

export function pageToHash(page: PageId): string {
  return page === 'home' ? '#/' : `#/${page}`;
}
